"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Center } from "@react-three/drei";
import { Suspense } from "react";
import { Model as HeadModel } from "@/components/Head";

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [0, 0, 10], zoom: 20 }} shadows>
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
        <pointLight position={[-1, 2, -2]} intensity={10} color="#ffffffff" />

        <Suspense fallback={null}>
          <Center>
            <HeadModel scale={1} />
          </Center>
        </Suspense>
      </Canvas>

      {/* Basic UI Overlay to test Zustand state later */}
      <div style={{ position: "absolute", top: 40, left: 40, zIndex: 10 }}>
        <h1 style={{ fontSize: "2rem", margin: 0, fontWeight: "bold" }}>Portfolio</h1>
        <p style={{ opacity: 0.7 }}>Interactive 3D Head Model</p>
      </div>
    </main>
  );
}
