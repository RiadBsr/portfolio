'use client'

import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import { useSceneLifecycle, type SceneLifecycleState } from '@/hooks/useSceneLifecycle'
import { SCENE_POSITIONS } from '@/components/SpiralCamera'

const LIFECYCLE = {
  enterStart: 0.08,
  enterEnd: 0.15,
  exitStart: 0.30,
  disposeAt: 0.50,
}

export function GoPro() {
  const lifecycle = useSceneLifecycle(LIFECYCLE)
  if (!lifecycle.shouldMount) return null
  return <GoProScene lifecycle={lifecycle} />
}

function GoProScene({ lifecycle }: { lifecycle: SceneLifecycleState }) {
  const gltf = useGLTF('/models/gopro.glb')
  const tex360 = useTexture('/textures/360.jpg')
  const groupRef = useRef<THREE.Group>(null!)
  const frntRef = useRef<THREE.Object3D | null>(null)
  const backRef = useRef<THREE.Object3D | null>(null)

  const clone = useMemo(() => {
    const cloned = gltf.scene.clone(true)

    // Configure the separately-loaded aligned texture to match GLTF UV conventions
    tex360.flipY = false
    tex360.colorSpace = THREE.SRGBColorSpace
    tex360.needsUpdate = true

    // Find named nodes
    const frntNode = cloned.getObjectByName('FRNT')
    const backNode = cloned.getObjectByName('BACK')
    const goProNode = cloned.getObjectByName('GoPro')
    frntRef.current = frntNode ?? null
    backRef.current = backNode ?? null

    // ── FRNT hemisphere — apply aligned 360° photo ──
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
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
      })))
    }

    // ── BACK hemisphere — keep existing unaligned texture, switch to unlit ──
    if (backNode && (backNode as THREE.Mesh).isMesh) {
      const mesh = backNode as THREE.Mesh
      const oldMat = mesh.material as THREE.MeshStandardMaterial
      mesh.material = new THREE.MeshBasicMaterial({
        map: oldMat.map,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
      const edges = new THREE.EdgesGeometry(mesh.geometry, 1)
      mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
      })))
    }

    // ── GoPro camera body — flat B&W materials + wireframe ──
    if (goProNode) {
      goProNode.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return
        const mesh = child as THREE.Mesh

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(mat => new THREE.MeshBasicMaterial({
            color: mat.name === 'Black' ? 0x000000 : 0xffffff,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          }))
        } else {
          const mat = mesh.material as THREE.Material
          mesh.material = new THREE.MeshBasicMaterial({
            color: mat.name === 'Black' ? 0x000000 : 0xffffff,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          })
        }

        const edges = new THREE.EdgesGeometry(mesh.geometry, 1)
        mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.4,
        })))
      })
    }

    return cloned
  }, [gltf.scene, tex360])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const { phase, enterProgress } = lifecycle

    if (phase === 'entering') {
      const t = 1 - Math.pow(1 - enterProgress, 3) // ease out cubic
      groupRef.current.scale.setScalar(Math.max(0.001, t))
      // Subtle drift from offset to final position
      groupRef.current.position.set(
        (1 - t) * 1.5,
        0,
        (1 - t) * 1,
      )
    } else if (phase === 'dwelling' || phase === 'exiting') {
      groupRef.current.scale.setScalar(1)
      groupRef.current.position.set(0, 0, 0)

      // Slow rotation during dwell
      if (frntRef.current) frntRef.current.rotation.y += delta * 0.15
      if (backRef.current) backRef.current.rotation.y += delta * 0.15
    }
  })

  const pos = SCENE_POSITIONS[1]

  return (
    <group position={[pos.x, pos.y, pos.z]} scale={0.5}>
      <group ref={groupRef} visible={lifecycle.visible}>
        <primitive object={clone} />
      </group>
    </group>
  )
}

useGLTF.preload('/models/gopro.glb')
