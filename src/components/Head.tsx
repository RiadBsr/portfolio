/*
Interactive 3D Head with bone-level cursor tracking + blink animation
*/

import * as THREE from 'three'
import React from 'react'
import { JSX } from 'react/jsx-runtime'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { dampQ } from 'maath/easing'

// Dummy objects for computing target quaternions
const dummyHead = new THREE.Object3D()
const dummyEyeL = new THREE.Object3D()
const dummyEyeR = new THREE.Object3D()

export function Model(props: JSX.IntrinsicElements['group']) {
  const gltf = useGLTF('/models/head.glb')

  // Create a fresh clone of the entire GLTF scene for each mount
  const clone = React.useMemo(() => {
    const cloned = gltf.scene.clone(true)

    // Rebind skeletons manually for skinned meshes
    const skinnedMeshes: THREE.SkinnedMesh[] = []
    const bones: THREE.Bone[] = []

    // Flat black material — unlit, no shading, cartoon-like pure black
    const flatBlack = new THREE.MeshBasicMaterial({ color: 0x000000 })

    cloned.traverse((node) => {
      // Disable frustum culling + enable shadows
      if ((node as THREE.Mesh).isMesh) {
        node.frustumCulled = false
        node.castShadow = true
        node.receiveShadow = true

        // Replace "Black" material with flat unlit black
        const mesh = node as THREE.Mesh
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
    }

    return cloned
  }, [gltf.scene])

  // Cache bone references
  const headBoneRef = React.useRef<THREE.Object3D | null>(null)
  const eyeLBoneRef = React.useRef<THREE.Object3D | null>(null)
  const eyeRBoneRef = React.useRef<THREE.Object3D | null>(null)
  const bonesFound = React.useRef(false)
  // Store rest quaternions so we compose rotation on top of them
  const eyeLRestQuat = React.useRef(new THREE.Quaternion())
  const eyeRRestQuat = React.useRef(new THREE.Quaternion())

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

    // Lazy discovery — use custom eye bones
    if (!bonesFound.current) {
      clone.traverse((child) => {
        if (child.name === 'Head') headBoneRef.current = child
        if (child.name === 'eyeL001') eyeLBoneRef.current = child
        if (child.name === 'eyeR001') eyeRBoneRef.current = child
      })
      // Save rest quaternions before we start modifying them
      if (eyeLBoneRef.current) eyeLRestQuat.current.copy(eyeLBoneRef.current.quaternion)
      if (eyeRBoneRef.current) eyeRRestQuat.current.copy(eyeRBoneRef.current.quaternion)
      bonesFound.current = true
    }

    const headBone = headBoneRef.current
    const eyeL = eyeLBoneRef.current
    const eyeR = eyeRBoneRef.current

    // Head: subtle, slow movement
    const maxHeadRotY = Math.PI / 6   // ~15 deg left/right
    const maxHeadRotX = Math.PI / 6   // ~12 deg up/down
    // Eyes: wider, snappier response
    const maxEyeRotY = Math.PI / 6     // ~45 deg left/right
    const maxEyeRotX = Math.PI / 12     // ~36 deg up/down

    if (headBone) {
      dummyHead.rotation.set(-state.pointer.y * maxHeadRotX, state.pointer.x * maxHeadRotY, 0)
      dummyHead.updateMatrix()
      dampQ(headBone.quaternion, dummyHead.quaternion, 0.25, delta)
    }

    // Eye rotation = restQuat * trackingRotation
    // Axes: X = up/down (flip sign), Z = left/right
    if (eyeL) {
      dummyEyeL.rotation.set(state.pointer.y * maxEyeRotX, 0, state.pointer.x * maxEyeRotY)
      dummyEyeL.updateMatrix()
      const targetQ = eyeLRestQuat.current.clone().multiply(dummyEyeL.quaternion)
      dampQ(eyeL.quaternion, targetQ, 0.08, delta)
    }

    if (eyeR) {
      dummyEyeR.rotation.set(state.pointer.y * maxEyeRotX, 0, state.pointer.x * maxEyeRotY)
      dummyEyeR.updateMatrix()
      const targetQ = eyeRRestQuat.current.clone().multiply(dummyEyeR.quaternion)
      dampQ(eyeR.quaternion, targetQ, 0.08, delta)
    }
  })

  return (
    <group {...props}>
      <primitive object={clone} />
    </group>
  )
}

useGLTF.preload('/models/head.glb')
