'use client'

import * as THREE from 'three'
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import { useSceneLifecycle, type SceneLifecycleState } from '@/hooks/useSceneLifecycle'
import { SCENE_POSITIONS } from '@/components/SpiralCamera'
import { easeInOut, easeOut } from '@/utils/easing'

// Shifted for INTRO_T=0.10: new = 0.10 + old * 0.90
const LIFECYCLE = {
  enterStart: 0.226,
  enterEnd:   0.235,
  exitStart:  0.307,
  disposeAt:  0.334,
}

// Hemisphere separation along local X when fully open
const HEMI_OPEN_OFFSET = 0.6
// Dwell progress thresholds for animation phases:
// 0.0–0.25  — hemispheres stay fully open (intro text visible, appreciate the setup)
// 0.25–0.45 — hemispheres close together
// 0.45–0.50 — brief pause (closed sphere)
// 0.50–0.85 — stitch sweep
const OPEN_END = 0.25
const CLOSE_END = 0.45
const STITCH_START = 0.50
const STITCH_END = 0.85

export function GoPro() {
  const lifecycle = useSceneLifecycle(LIFECYCLE)
  if (!lifecycle.shouldMount) return null
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
  const groupRef = useRef<THREE.Group>(null!)
  const frntRef = useRef<THREE.Object3D | null>(null)
  const backRef = useRef<THREE.Object3D | null>(null)
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
      mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.5,
      })))
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
      mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.5,
      })))
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
    return () => {
      frntRef.current = null
      backRef.current = null
    }
  }, [clone])

  useFrame(() => {
    if (!groupRef.current) return

    const { phase, enterProgress, dwellProgress } = lifecycle

    if (phase === 'entering') {
      // Scale in with snappy ease-out (enterProgress already has easeInOut from lifecycle)
      const t = easeOut(enterProgress, 2)
      groupRef.current.scale.setScalar(Math.max(0.001, t))
      // Hemispheres fully open during enter
      if (frntRef.current) frntRef.current.position.x = HEMI_OPEN_OFFSET
      if (backRef.current) backRef.current.position.x = -HEMI_OPEN_OFFSET
    } else if (phase === 'dwelling' || phase === 'exiting') {
      groupRef.current.scale.setScalar(1)

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
    }
  })

  const pos = SCENE_POSITIONS[1]
  // Compute stitch progress for the ring visual
  const { dwellProgress } = lifecycle
  const stitchActive = dwellProgress >= STITCH_START && dwellProgress <= STITCH_END
  const stitchProgress = stitchActive
    ? (dwellProgress - STITCH_START) / (STITCH_END - STITCH_START)
    : 0

  return (
    <group position={[pos.x, pos.y, pos.z]} rotation-y={0.3 * Math.PI}>
      <group ref={groupRef} visible={lifecycle.visible} scale={0.001}>
        <primitive object={clone} />
        {stitchActive && <StitchRing progress={stitchProgress} />}
      </group>
    </group>
  )
}

useGLTF.preload('/models/gopro.glb')
useTexture.preload('/textures/360.jpg')
useTexture.preload('/textures/360_unaligned.jpg')
