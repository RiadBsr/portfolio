"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { Model as HeadModel } from "@/components/Head";
import { SpiralCamera } from "@/components/SpiralCamera";

// Mute the THREE.Clock deprecation warning until @react-three/fiber updates to THREE.Timer
if (typeof console !== 'undefined') {
  const originalWarn = console.warn
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock: This module has been deprecated')) return
    if (typeof args[0] === 'string' && args[0].includes('THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated')) return
    originalWarn(...args)
  }
}

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ fov: 50, near: 0.1, far: 200, position: [2, 0, 0] }} shadows={{ type: THREE.PCFShadowMap }}>
        <color attach="background" args={["#050505"]} />

        {/* Minimal ambient fill — keeps deep shadows */}
        <ambientLight intensity={0.1} />

        {/* Key spotlight from above-front — dramatic falloff */}
        <spotLight
          position={[0, 2, 3]}
          angle={0.2}
          penumbra={0.8}
          intensity={30}
          distance={50}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
          color="#ffffff"
        />

        {/* Subtle rim light from behind — adds depth/edge separation */}
        <pointLight position={[-1, 2, -2]} intensity={10} color="#ffffff" />

        <SpiralCamera />

        <Suspense fallback={null}>
          <HeadModel scale={1} />
        </Suspense>
      </Canvas>

      {/* Basic UI Overlay to test Zustand state later */}
      <div style={{ position: "absolute", top: 40, left: 40, zIndex: 10 }}>
        <h1 style={{ fontSize: "2rem", margin: 0, fontWeight: "bold" }}>Portfolio</h1>
        <p style={{ opacity: 0.7 }}>Work in progress</p>
      </div>
    </main>
  );
}
