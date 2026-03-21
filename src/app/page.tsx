"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { Model as HeadModel } from "@/components/Head";
import { SpiralCamera } from "@/components/SpiralCamera";
import { Particles } from "@/components/Particles";
import { Annotations } from "@/components/Annotations";
import { HUD } from "@/components/HUD";
import { GoPro } from "@/components/scenes/GoPro";
import { GoProIntro } from "@/components/scenes/GoProIntro";
import { DevOverlay } from "@/components/DevOverlay";
import { IntroOverlay } from "@/components/IntroOverlay";
import { ChatPanel } from "@/components/ChatPanel";
import { Loader } from "@/components/Loader";
import { GPUWarmup } from "@/components/GPUWarmup";
import { useScroll } from "@/hooks/useScroll";
import { useAutoDrift } from "@/hooks/useAutoDrift";

// Suppress deprecation warnings from Three.js r183 until R3F ships updated internals
if (typeof console !== 'undefined') {
  const originalWarn = console.warn
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock: This module has been deprecated')) return
    if (typeof args[0] === 'string' && args[0].includes('THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated')) return
    originalWarn(...args)
  }
}

export default function Home() {
  // Side-effect hooks — no return value, just set up event listeners
  useScroll()
  useAutoDrift()

  return (
    <main style={{ width: "100vw", height: "100dvh" }}>
      <Canvas
        // Perspective camera — fov 14 (telephoto), starts directly in front of the head.
        // SpiralCamera takes over positioning on the first frame.
        camera={{ fov: 14, near: 0.1, far: 200, position: [0, 0, 1.3] }}
        shadows={{ type: THREE.PCFShadowMap }}
      >
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
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-bias={-0.0001}
          color="#ffffff"
        />

        {/* Rim light from behind — adds depth/edge separation */}
        <pointLight position={[-1, 2, -2]} intensity={10} color="#ffffff" />

        {/* Camera controller — drives position along Archimedean spiral */}
        <SpiralCamera />

        {/* Ambient particle cloud centered on head */}
        <Particles />

        {/* S-0 face annotations — fade out and unmount as camera pulls back */}
        <Annotations />

        {/* All async assets (GLTFs, textures) under one Suspense — Loader shows progress */}
        <Suspense fallback={null}>
          <HeadModel scale={1} />
          <GoPro />
          <GPUWarmup />
        </Suspense>
      </Canvas>

      {/* Loading screen — shows progress while GLTFs + textures load, fades out */}
      <Loader />

      {/* WIP overlay — blurs canvas after last finished scene (update fromScrollT as scenes ship) */}
      <DevOverlay fromScrollT={0.3} />

      {/* Intro overlay — name + scroll cue, fades out as straight pullback ends */}
      <IntroOverlay />

      {/* GoPro scene intro — title + description, builds narrative before stitching animation */}
      <GoProIntro />

      {/* Persistent HTML overlay — outside Canvas, always on top */}
      <HUD />

      {/* AI Clone chat panel — placeholder until 3D tablet is ready */}
      <ChatPanel />
    </main>
  );
}
