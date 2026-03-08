# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test suite is configured.

## Architecture

Single-page Next.js 15 app (App Router) with a full-viewport Three.js scene as the main content.

**Key stack:** React 19, TypeScript, Three.js + `@react-three/fiber` + `@react-three/drei`, GSAP, Lenis, Zustand, Tailwind CSS v4, `maath`.

**Path alias:** `@/*` → `./src/*`

### File structure

```
src/
  app/
    layout.tsx      # Root layout — Geist font, metadata
    page.tsx        # Home page — R3F Canvas setup, lighting rig, UI overlay
    globals.css     # Global reset + CSS variables (dark theme, overflow:hidden)
  components/
    Head.tsx        # Interactive 3D head model (the core visual)
public/
  models/
    head.glb        # GLTF model with skeleton, BlinkAction animation, materials
```

### Head.tsx — core component

The `Model` component in `Head.tsx` is the entire visual centerpiece. Key implementation details:

- **Skeletal wireframe overlay:** `createSharpEdgeGeometry` extracts boundary/hard edges from skinned mesh geometry (edges appearing only once in the index buffer). These are rendered as `THREE.LineSegments` with a custom `ShaderMaterial` that supports skinning via duck-typing (`isSkinnedMesh`, `skeleton`, `bindMatrix`, `bindMatrixInverse`) so WebGLRenderer uploads bone matrices.
- **Cursor tracking:** `useFrame` reads `state.pointer` (normalized -1 to 1) and applies damped quaternion rotation to the `Head`, `eyeL001`, and `eyeR001` bones via `dampQ` from `maath/easing`. Eye rotation is composed on top of saved rest quaternions.
- **Gyroscope (mobile):** `DeviceOrientationEvent` listener normalizes `beta`/`gamma` into the same -1/1 range as `state.pointer`, used instead of cursor when on mobile + gyro available.
- **Blink animation:** `THREE.AnimationMixer` plays the `BlinkAction` clip filtered to only lid/eyelash bone tracks. Triggered randomly every 2–6s with a 15% chance of a double-blink.
- **Performance:** Eyelashes hidden on `window.innerWidth < 768`. Frustum culling disabled on all meshes.
- **Materials:** `Black`-named material replaced with flat unlit `MeshBasicMaterial`; `polygonOffset` used on all mesh materials to prevent Z-fighting with the wireframe lines.

### Lighting (page.tsx)

- `ambientLight` intensity 0.1 (minimal fill)
- `spotLight` from above-front for dramatic key light
- `pointLight` rim light from behind-left
- Shadow type: `THREE.PCFShadowMap`
