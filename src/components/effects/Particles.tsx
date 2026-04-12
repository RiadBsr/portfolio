'use client'

import * as THREE from 'three'
import { useMemo } from 'react'
import { CAMERA_STOPS } from '@/components/camera/CameraRig'

// Head cluster — dense around origin for the S-0 close-up
const HEAD_COUNT = 300
const HEAD_SIGMA = 3

// Path dust — scattered along the camera path for parallax depth cues
const PATH_COUNT = 400
const PATH_SPREAD = 5

// Scene dust — scattered around each scene object for local ambiance
const SCENE_SPREAD = 5
const SCENE_COUNT_PER = 100

// Recreate the same path as CameraRig for particle scattering
const _particlePath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,   0,    1.3),
  new THREE.Vector3(0,   0,    3),
  new THREE.Vector3(0,   0,    8),
  new THREE.Vector3(0,   0,   12),
  new THREE.Vector3(-2,  0,   16),
  new THREE.Vector3(-6,  0,   18),
  new THREE.Vector3(-12, 0,   18),
  new THREE.Vector3(-18, 0,   18),
], false, 'centripetal', 0.5)

function gaussRandom(): number {
  const u = 1 - Math.random()
  const v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const _sample = new THREE.Vector3()

export function Particles() {
  const positions = useMemo(() => {
    const sceneCount = CAMERA_STOPS.length - 1
    const total = HEAD_COUNT + PATH_COUNT + sceneCount * SCENE_COUNT_PER
    const arr = new Float32Array(total * 3)
    let idx = 0

    // 1) Head cluster — Gaussian around origin
    for (let i = 0; i < HEAD_COUNT; i++) {
      arr[idx++] = gaussRandom() * HEAD_SIGMA
      arr[idx++] = gaussRandom() * HEAD_SIGMA
      arr[idx++] = gaussRandom() * HEAD_SIGMA
    }

    // 2) Path dust — scatter along the CatmullRom camera path
    for (let i = 0; i < PATH_COUNT; i++) {
      const t = Math.random()
      _particlePath.getPointAt(t, _sample)
      arr[idx++] = _sample.x + gaussRandom() * PATH_SPREAD
      arr[idx++] = _sample.y + gaussRandom() * PATH_SPREAD
      arr[idx++] = _sample.z + gaussRandom() * PATH_SPREAD
    }

    // 3) Scene dust — Gaussian cloud around each scene object (skip S-0, covered by head cluster)
    for (let s = 1; s < CAMERA_STOPS.length; s++) {
      const pos = CAMERA_STOPS[s].objectPosition
      for (let i = 0; i < SCENE_COUNT_PER; i++) {
        arr[idx++] = pos.x + gaussRandom() * SCENE_SPREAD
        arr[idx++] = pos.y + gaussRandom() * SCENE_SPREAD
        arr[idx++] = pos.z + gaussRandom() * SCENE_SPREAD
      }
    }

    return arr
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.06}
        transparent
        opacity={0.3}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
