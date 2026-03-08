'use client'

import { useMemo } from 'react'

const COUNT = 200
const SIGMA = 3 // Gaussian spread — tight cluster near head, thinning outward

// Box-Muller transform for standard normal random variable
function gaussRandom(): number {
  const u = 1 - Math.random()
  const v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function Particles() {
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3]     = gaussRandom() * SIGMA
      arr[i * 3 + 1] = gaussRandom() * SIGMA
      arr[i * 3 + 2] = gaussRandom() * SIGMA
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
        opacity={0.15}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
