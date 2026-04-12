'use client'

import * as THREE from 'three'
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import { useSceneLifecycle, type SceneLifecycleState } from '@/hooks/useSceneLifecycle'
import { SCENE_OBJECT_POSITIONS, SCENE_MOBILE_POSITIONS } from '@/components/camera/CameraRig'
import { easeInOut, easeOut } from '@/utils/easing'
import { damp } from 'maath/easing'
import { GoProAnnotation } from './GoProAnnotation'

// Lifecycle timing — controls ANIMATIONS only, not mount/visibility.
// The object is always present in world space; the camera travels to it.
const LIFECYCLE = {
  enterStart: 0.20,   // hemisphere open as camera curves and GoPro enters view
  enterEnd:   0.24,   // camera arrives at dwell position
  exitStart:  0.34,   // near end of dwell — hemispheres close back
  disposeAt:  0.40,   // animations complete
}

// Hemisphere separation along local X when fully open
const HEMI_OPEN_OFFSET = 0.6
// Scene-wide entry rotation — start showing a bit of the front lens,
// settle to pure side view by the end of the entering phase.
const BASE_ROT_Y = Math.PI / 2          // side view (stitch seam faces camera)
const ENTRY_ROT_Y_OFFSET = 0.55         // extra rotation at enter start — reveals front lens (opposite side)
// Dwell progress thresholds for animation phases:
// 0.0–0.20  — hemispheres stay fully open (intro text visible, appreciate the setup)
// 0.20–0.40 — hemispheres close together
// 0.40–0.50 — brief pause (closed sphere)
// 0.50–0.80 — stitch sweep
const OPEN_END = 0.2
const CLOSE_END = 0.4
const STITCH_START = 0.45
const STITCH_END = 0.80
// Wireframe on the hemispheres fades out as the stitch completes, selling the
// "seam gone" moment. Starts slightly before STITCH_END so the lines melt away
// as the textures lock in rather than popping off after.
const WIRE_FADE_START = 0.70
const WIRE_FADE_END = 0.82
// Celebratory 180° spin after stitch finishes — sphere now appears seamless,
// so showing the back half sells "the seam is gone from every angle".
const SPIN_START = 0.83
const SPIN_END = 0.95

export function GoPro() {
  const lifecycle = useSceneLifecycle(LIFECYCLE)
  // Always render — the object is persistent in world space.
  // Only animations (hemisphere open/close, stitch) are gated by lifecycle phase.
  return <GoProScene lifecycle={lifecycle} />
}

// Stitch-line ring geometry — a thin torus at the equator
function StitchRing({ progress }: { progress: number }) {
  const ringRef = useRef<THREE.Mesh>(null!)

  useFrame(() => {
    if (!ringRef.current) return
    // Sweep ring from top (Y=1) to bottom (Y=-1) driven by progress
    ringRef.current.position.y = 1 - progress * 2
    // Pulse emission intensity
    const mat = ringRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.4 + Math.sin(progress * Math.PI * 6) * 0.2
  })

  return (
    <mesh ref={ringRef} rotation-x={Math.PI / 2}>
      <torusGeometry args={[Math.sin(Math.acos(0)) /* radius 1 at equator */, 0.015, 8, 64]} />
      <meshBasicMaterial color={0x00ffaa} transparent opacity={0.5} depthWrite={false} />
    </mesh>
  )
}

function GoProScene({ lifecycle }: { lifecycle: SceneLifecycleState }) {
  const gltf = useGLTF('/models/gopro.glb')
  const tex360 = useTexture('/textures/360.jpg')
  const tex360Unaligned = useTexture('/textures/360_unaligned.jpg')
  const outerGroupRef = useRef<THREE.Group>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const frntRef = useRef<THREE.Object3D | null>(null)
  const backRef = useRef<THREE.Object3D | null>(null)
  const hemiWireMatsRef = useRef<THREE.LineBasicMaterial[]>([])
  const mixTUniform = useRef({ value: 0.0 })

  const clone = useMemo(() => {
    const cloned = gltf.scene.clone(true)

    // Configure textures for GLTF UV conventions
    tex360.flipY = false
    tex360.colorSpace = THREE.SRGBColorSpace
    tex360.needsUpdate = true
    tex360Unaligned.flipY = false
    tex360Unaligned.colorSpace = THREE.SRGBColorSpace
    tex360Unaligned.needsUpdate = true

    const frntNode = cloned.getObjectByName('FRNT')
    const backNode = cloned.getObjectByName('BACK')
    const goProNode = cloned.getObjectByName('GoPro')

    // ── FRNT hemisphere — aligned 360° photo ──
    if (frntNode && (frntNode as THREE.Mesh).isMesh) {
      const mesh = frntNode as THREE.Mesh
      mesh.material = new THREE.MeshBasicMaterial({
        map: tex360,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
      const edges = new THREE.EdgesGeometry(mesh.geometry, 1)
      const wireMat = new THREE.LineBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.5,
      })
      wireMat.userData.baseOpacity = 0.5
      mesh.add(new THREE.LineSegments(edges, wireMat))
    }

    // ── BACK hemisphere — blends from unaligned to aligned during stitch ──
    if (backNode && (backNode as THREE.Mesh).isMesh) {
      const mesh = backNode as THREE.Mesh
      const mat = new THREE.MeshBasicMaterial({
        map: tex360Unaligned,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.texB = { value: tex360 }
        shader.uniforms.mixT = mixTUniform.current
        shader.fragmentShader = 'uniform sampler2D texB;\nuniform float mixT;\n' + shader.fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          /* glsl */ `
          #ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D(map, vMapUv);
            vec4 texBColor = texture2D(texB, vMapUv);
            diffuseColor *= mix(sampledDiffuseColor, texBColor, mixT);
          #endif
          `,
        )
      }
      mesh.material = mat
      const edges = new THREE.EdgesGeometry(mesh.geometry, 1)
      const wireMat = new THREE.LineBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.5,
      })
      wireMat.userData.baseOpacity = 0.5
      mesh.add(new THREE.LineSegments(edges, wireMat))
    }

    // ── GoPro camera body — flat B&W materials + wireframe ──
    if (goProNode) {
      goProNode.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return
        const mesh = child as THREE.Mesh
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => new THREE.MeshBasicMaterial({
            color: m.name === 'Black' ? 0x000000 : 0xffffff,
            polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
          }))
        } else {
          const m = mesh.material as THREE.Material
          mesh.material = new THREE.MeshBasicMaterial({
            color: m.name === 'Black' ? 0x000000 : 0xffffff,
            polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
          })
        }
        const edges = new THREE.EdgesGeometry(mesh.geometry, 1)
        mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
          color: 0x000000, transparent: true, opacity: 0.4,
        })))
      })
    }

    return cloned
  }, [gltf.scene, tex360, tex360Unaligned])

  // Set node refs from the rendered clone (not inside useMemo — React Strict Mode
  // double-invokes useMemo in dev, which would leave refs pointing to an orphaned clone)
  useEffect(() => {
    frntRef.current = clone.getObjectByName('FRNT') ?? null
    backRef.current = clone.getObjectByName('BACK') ?? null
    const mats: THREE.LineBasicMaterial[] = []
    for (const node of [frntRef.current, backRef.current]) {
      node?.traverse((child) => {
        if ((child as THREE.LineSegments).isLineSegments) {
          const m = (child as THREE.LineSegments).material as THREE.LineBasicMaterial
          if (m.userData.baseOpacity !== undefined) mats.push(m)
        }
      })
    }
    hemiWireMatsRef.current = mats
    return () => {
      frntRef.current = null
      backRef.current = null
      hemiWireMatsRef.current = []
    }
  }, [clone])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const { phase, enterProgress, dwellProgress } = lifecycle

    // Always full scale — persistent object, no pop-in
    groupRef.current.scale.setScalar(1.4)

    // Scene-wide entry rotation — reveal front lens briefly, settle to side view.
    // enterProgress is already eased by useSceneLifecycle (easeInOut), so we use
    // it linearly here. Rotation is then damped to smooth over scroll jitter.
    if (outerGroupRef.current) {
      let targetRotY: number
      if (phase === 'idle') {
        targetRotY = BASE_ROT_Y + ENTRY_ROT_Y_OFFSET
      } else if (phase === 'entering') {
        targetRotY = BASE_ROT_Y + ENTRY_ROT_Y_OFFSET * (1 - enterProgress)
      } else {
        targetRotY = BASE_ROT_Y
      }
      // Triggered 180° spin after stitch completes — additive, eased
      if ((phase === 'dwelling' || phase === 'exiting') && dwellProgress >= SPIN_START) {
        const spinT = Math.min(1, (dwellProgress - SPIN_START) / (SPIN_END - SPIN_START))
        targetRotY += Math.PI * easeInOut(spinT)
      } else if (phase === 'disposed') {
        targetRotY += Math.PI
      }
      damp(outerGroupRef.current.rotation, 'y', targetRotY, 0.15, delta)
    }

    if (phase === 'entering') {
      // Hemispheres spread open as camera approaches
      const t = easeOut(enterProgress, 2)
      const offset = HEMI_OPEN_OFFSET * t
      if (frntRef.current) frntRef.current.position.x = offset
      if (backRef.current) backRef.current.position.x = -offset
    } else if (phase === 'dwelling' || phase === 'exiting') {
      if (dwellProgress < OPEN_END) {
        // Phase 0: hemispheres stay fully open
        if (frntRef.current) frntRef.current.position.x = HEMI_OPEN_OFFSET
        if (backRef.current) backRef.current.position.x = -HEMI_OPEN_OFFSET
      } else if (dwellProgress < CLOSE_END) {
        // Phase A: hemispheres close together with snappy ease-in-out
        const closeT = (dwellProgress - OPEN_END) / (CLOSE_END - OPEN_END)
        const eased = easeInOut(closeT)
        const offset = HEMI_OPEN_OFFSET * (1 - eased)
        if (frntRef.current) frntRef.current.position.x = offset
        if (backRef.current) backRef.current.position.x = -offset
      } else {
        // Hemispheres fully closed
        if (frntRef.current) frntRef.current.position.x = 0
        if (backRef.current) backRef.current.position.x = 0

        if (dwellProgress >= STITCH_START && dwellProgress <= STITCH_END) {
          // Phase B: stitch sweep — eased blend for satisfying texture transition
          const stitchT = (dwellProgress - STITCH_START) / (STITCH_END - STITCH_START)
          mixTUniform.current.value = easeInOut(stitchT)
        }
      }
    } else {
      // idle or disposed — resting state: hemispheres closed together
      if (frntRef.current) frntRef.current.position.x = 0
      if (backRef.current) backRef.current.position.x = 0
    }

    // Hemisphere wireframe fade — tied to stitch completion
    let wireT = 0
    if (phase === 'dwelling' || phase === 'exiting') {
      wireT = Math.min(1, Math.max(0, (dwellProgress - WIRE_FADE_START) / (WIRE_FADE_END - WIRE_FADE_START)))
    } else if (phase === 'disposed') {
      wireT = 1
    }
    for (const m of hemiWireMatsRef.current) {
      m.opacity = (m.userData.baseOpacity as number) * (1 - wireT)
    }
  })

  const { size } = useThree()
  const isMobile = size.width < 768
  const pos = isMobile ? SCENE_MOBILE_POSITIONS[1] : SCENE_OBJECT_POSITIONS[1]
  // Compute stitch progress for the ring visual
  const { dwellProgress } = lifecycle
  const stitchActive = dwellProgress >= STITCH_START && dwellProgress <= STITCH_END
  const stitchProgress = stitchActive
    ? (dwellProgress - STITCH_START) / (STITCH_END - STITCH_START)
    : 0

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <group ref={outerGroupRef} rotation-y={BASE_ROT_Y}>
        <group ref={groupRef}>
          <primitive object={clone} />
          {stitchActive && <StitchRing progress={stitchProgress} />}
          <GoProAnnotation lifecycle={lifecycle} fadeOutStart={OPEN_END} fadeOutEnd={CLOSE_END} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/gopro.glb')
useTexture.preload('/textures/360.jpg')
useTexture.preload('/textures/360_unaligned.jpg')
