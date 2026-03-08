/*
Interactive 3D Head with bone-level cursor tracking + blink animation
*/

import * as THREE from 'three'
import React from 'react'
import { JSX } from 'react/jsx-runtime'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { dampQ } from 'maath/easing'

// Dummy objects for computing target quaternions (allocated once, reused every frame)
const dummyHead = new THREE.Object3D()
const dummyEyeL = new THREE.Object3D()
const dummyEyeR = new THREE.Object3D()
// Pre-allocated quaternions for eye tracking — avoids .clone() allocation every frame
const _eyeLTargetQ = new THREE.Quaternion()
const _eyeRTargetQ = new THREE.Quaternion()

// Helpers to extract sharp edges exclusively (relies on split vertices from Blender's Edge Split output)
function createSharpEdgeGeometry(geometry: THREE.BufferGeometry) {
  const index = geometry.index?.array
  if (!index) return null

  const edgeCount = new Map<string, number>()

  // Count edge occurrences (unordered integer pairs)
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i]
    const b = index[i + 1]
    const c = index[i + 2]

    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1)
    }
  }

  const lineIndices: number[] = []
  for (const [key, count] of edgeCount.entries()) {
    if (count === 1) { // Appears exactly once -> it's a split/hard edge or mesh boundary!
      const [u, v] = key.split('_').map(Number)
      lineIndices.push(u, v)
    }
  }

  if (lineIndices.length === 0) return null

  const linesGeo = new THREE.BufferGeometry()
  linesGeo.setAttribute('position', geometry.getAttribute('position'))
  if (geometry.getAttribute('skinIndex')) {
    linesGeo.setAttribute('skinIndex', geometry.getAttribute('skinIndex'))
  }
  if (geometry.getAttribute('skinWeight')) {
    linesGeo.setAttribute('skinWeight', geometry.getAttribute('skinWeight'))
  }
  linesGeo.setIndex(lineIndices)

  return linesGeo
}

// Custom Material that renders lines but natively supports Skeletal Animation
const edgeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    color: { value: new THREE.Color(0x000000) },
    opacity: { value: 0.4 } // Lowering opacity makes 1px lines visually appear "thinner"
  },
  vertexShader: `
    #include <common>
    #include <skinning_pars_vertex>
    void main() {
      #include <skinbase_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform float opacity;
    void main() {
      gl_FragColor = vec4(color, opacity);
    }
  `,
  transparent: true,
  depthTest: true,
  depthWrite: false,
})

export function Model(props: JSX.IntrinsicElements['group']) {
  const gltf = useGLTF('/models/head.glb')

  // Create a fresh clone of the entire GLTF scene for each mount
  const clone = React.useMemo(() => {
    const cloned = gltf.scene.clone(true)

    // Rebind skeletons manually for skinned meshes
    const skinnedMeshes: THREE.SkinnedMesh[] = []
    const bones: THREE.Bone[] = []

    // Flat black material — unlit, no shading, cartoon-like pure black
    // Use polygonOffset to push the mesh slightly back in the depth buffer,
    // so the wireframe lines perfectly sit on top without Z-fighting or bleed-through from the back
    const flatBlack = new THREE.MeshBasicMaterial({
      color: 0x000000,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })

    cloned.traverse((node) => {
      // Disable frustum culling + enable shadows
      if ((node as THREE.Mesh).isMesh) {
        node.frustumCulled = false
        node.castShadow = true
        node.receiveShadow = true

        const mesh = node as THREE.Mesh

        // Apply polygonOffset to existing materials (like the white parts) so they also sit back
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            mat.polygonOffset = true
            mat.polygonOffsetFactor = 1
            mat.polygonOffsetUnits = 1
            mat.needsUpdate = true
          })
        } else if (mesh.material) {
          mesh.material.polygonOffset = true
          mesh.material.polygonOffsetFactor = 1
          mesh.material.polygonOffsetUnits = 1
          mesh.material.needsUpdate = true
        }

        // Replace "Black" material with flat unlit black
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) =>
            mat.name === 'Black' ? flatBlack : mat
          )
        } else if (mesh.material && (mesh.material as THREE.Material).name === 'Black') {
          mesh.material = flatBlack
        }
      }
      if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshes.push(node as THREE.SkinnedMesh)
      }
      if ((node as THREE.Bone).isBone) {
        bones.push(node as THREE.Bone)
      }
    })

    // Rebind each skinned mesh to the cloned bones
    for (const mesh of skinnedMeshes) {
      const oldBones = mesh.skeleton.bones
      const newBones = oldBones.map((oldBone) => {
        return bones.find((b) => b.name === oldBone.name) || oldBone
      })
      mesh.skeleton = new THREE.Skeleton(newBones)
      mesh.bind(mesh.skeleton)

      // Add blueprint-style wireframe overlay for sharp edges (excluding eyelashes)
      if (!mesh.name.toLowerCase().includes('eyelash')) {
        const linesGeo = createSharpEdgeGeometry(mesh.geometry)
        if (linesGeo) {
          const lines = new THREE.LineSegments(linesGeo, edgeMaterial)

            // Duck-type as a SkinnedMesh so WebGLRenderer will inject and upload bone matrices
            ; (lines as any).isSkinnedMesh = true
            ; (lines as any).skeleton = mesh.skeleton
            ; (lines as any).bindMatrix = mesh.bindMatrix
            ; (lines as any).bindMatrixInverse = mesh.bindMatrixInverse

          if (mesh.parent) {
            mesh.parent.add(lines)
            lines.position.copy(mesh.position)
            lines.quaternion.copy(mesh.quaternion)
            lines.scale.copy(mesh.scale)
          }
        }
      }
    }

    return cloned
  }, [gltf.scene])

  // Cached isMobile flag — updated via resize listener, read every frame without DOM access
  const isMobileRef = React.useRef(false)

  // Store eyelash node refs for fast toggle (avoids traverse on every resize)
  const eyelashRefs = React.useRef<THREE.Object3D[]>([])

  React.useEffect(() => {
    const nodes: THREE.Object3D[] = []
    clone.traverse((node) => {
      if (node.name.toLowerCase().includes('eyelash')) nodes.push(node)
    })
    eyelashRefs.current = nodes
  }, [clone])

  // Disable eyelashes on mobile for performance + cache isMobile
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      isMobileRef.current = mobile
      for (const node of eyelashRefs.current) node.visible = !mobile
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Resolve bone references once via getObjectByName (no traverse)
  const headBoneRef = React.useRef<THREE.Object3D | null>(null)
  const eyeLBoneRef = React.useRef<THREE.Object3D | null>(null)
  const eyeRBoneRef = React.useRef<THREE.Object3D | null>(null)
  const eyeLRestQuat = React.useRef(new THREE.Quaternion())
  const eyeRRestQuat = React.useRef(new THREE.Quaternion())

  React.useEffect(() => {
    headBoneRef.current = clone.getObjectByName('Head') ?? null
    eyeLBoneRef.current = clone.getObjectByName('eyeL001') ?? null
    eyeRBoneRef.current = clone.getObjectByName('eyeR001') ?? null
    // Save rest quaternions before we start modifying them
    if (eyeLBoneRef.current) eyeLRestQuat.current.copy(eyeLBoneRef.current.quaternion)
    if (eyeRBoneRef.current) eyeRRestQuat.current.copy(eyeRBoneRef.current.quaternion)
  }, [clone])

  // Hardware Gyroscope tracking for Mobile
  const simulatedPointer = React.useRef({ x: 0, y: 0 })
  const hasGyro = React.useRef(false)

  React.useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null && e.gamma !== null) {
        hasGyro.current = true
        // e.beta (front-to-back tilt): typical holding range is ~20 (flat) to ~90 (upright)
        // Normalize 45deg as "center" (0), mapped roughly from -30 to 30 deg deflection
        let normalizedBeta = (e.beta - 45) / 30

        // e.gamma (left-to-right tilt): range is -90 to 90. We care about -30 to 30 mostly.
        let normalizedGamma = e.gamma / 30

        // Clamp to [-1, 1] range to match R3F state.pointer behavior
        simulatedPointer.current.y = Math.max(-1, Math.min(1, normalizedBeta)) // pitch
        simulatedPointer.current.x = Math.max(-1, Math.min(1, normalizedGamma)) // yaw
      }
    }

    // Only add listener if we're in a secure context (HTTPS/localhost) which is required for gyroscope
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation)
    }

    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [])

  // Manual animation mixer
  const mixerRef = React.useRef<THREE.AnimationMixer | null>(null)
  const blinkActionRef = React.useRef<THREE.AnimationAction | null>(null)

  React.useEffect(() => {
    const mixer = new THREE.AnimationMixer(clone)
    mixerRef.current = mixer

    // Find BlinkAction and filter to ONLY eyelid tracks
    const blinkClip = gltf.animations.find((clip) => clip.name === 'BlinkAction')
    if (blinkClip) {
      const filteredClip = blinkClip.clone()
      filteredClip.tracks = filteredClip.tracks.filter((track) => {
        const boneName = track.name.split('.')[0]
        return boneName.toLowerCase().includes('lid') ||
          boneName.toLowerCase().includes('eyelash')
      })

      const action = mixer.clipAction(filteredClip)
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = false
      blinkActionRef.current = action
    }

    // Random blink timer
    let timeoutId: ReturnType<typeof setTimeout>

    function triggerBlink() {
      const action = blinkActionRef.current
      if (action) {
        action.reset().play()
        if (Math.random() < 0.15) {
          setTimeout(() => action.reset().play(), 200)
        }
      }
      const nextDelay = 2000 + Math.random() * 4000
      timeoutId = setTimeout(triggerBlink, nextDelay)
    }

    timeoutId = setTimeout(triggerBlink, 1000 + Math.random() * 2000)

    return () => {
      clearTimeout(timeoutId)
      mixer.stopAllAction()
    }
  }, [clone, gltf.animations])

  useFrame((state, delta) => {
    mixerRef.current?.update(delta)

    const headBone = headBoneRef.current
    const eyeL = eyeLBoneRef.current
    const eyeR = eyeRBoneRef.current
    const isMobile = isMobileRef.current

    // Use gyroscope input if available, otherwise fallback to mouse/cursor position
    const pointerX = (isMobile && hasGyro.current) ? simulatedPointer.current.x : state.pointer.x
    const pointerY = (isMobile && hasGyro.current) ? simulatedPointer.current.y : -state.pointer.y

    // Head: subtle, slow movement
    const maxHeadRotY = isMobile ? Math.PI / 15 : Math.PI / 6
    const maxHeadRotX = Math.PI / 6
    // Eyes: wider, snappier response
    const maxEyeRotY = isMobile ? Math.PI / 12 : Math.PI / 6
    const maxEyeRotX = Math.PI / 12

    if (headBone) {
      dummyHead.rotation.set(pointerY * maxHeadRotX, pointerX * maxHeadRotY, 0)
      dummyHead.updateMatrix()
      dampQ(headBone.quaternion, dummyHead.quaternion, 0.25, delta)
    }

    // Eye rotation = restQuat * trackingRotation
    // Axes: X = up/down (flip sign), Z = left/right
    if (eyeL) {
      dummyEyeL.rotation.set(-pointerY * maxEyeRotX, 0, pointerX * maxEyeRotY)
      dummyEyeL.updateMatrix()
      _eyeLTargetQ.copy(eyeLRestQuat.current).multiply(dummyEyeL.quaternion)
      dampQ(eyeL.quaternion, _eyeLTargetQ, 0.08, delta)
    }

    if (eyeR) {
      dummyEyeR.rotation.set(-pointerY * maxEyeRotX, 0, pointerX * maxEyeRotY)
      dummyEyeR.updateMatrix()
      _eyeRTargetQ.copy(eyeRRestQuat.current).multiply(dummyEyeR.quaternion)
      dampQ(eyeR.quaternion, _eyeRTargetQ, 0.08, delta)
    }
  })

  return (
    <group {...props}>
      <primitive object={clone} />
    </group>
  )
}

useGLTF.preload('/models/head.glb')
