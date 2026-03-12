'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

/**
 * Eagerly uploads all pending textures and geometries to the GPU
 * after Suspense resolves, preventing frame spikes on first render.
 * Place inside Canvas, within the Suspense boundary.
 */
export function GPUWarmup() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    // Traverse the full scene graph and push textures to the GPU
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return
      const mesh = obj as THREE.Mesh

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of materials) {
        if (!mat) continue
        // Walk all material properties looking for textures to upload
        for (const key of Object.keys(mat)) {
          const val = (mat as unknown as Record<string, unknown>)[key]
          if (val && (val as THREE.Texture).isTexture) {
            gl.initTexture(val as THREE.Texture)
          }
        }
      }
    })

    // Compile all shaders upfront — avoids jank on first draw call per material
    gl.compile(scene, scene.children.find(
      (c) => (c as THREE.Camera).isCamera
    ) as THREE.Camera || new THREE.PerspectiveCamera())
  }, [gl, scene])

  return null
}
