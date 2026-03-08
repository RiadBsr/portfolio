# Portfolio Research — Storyboard v3 Implementation Analysis

## 1. Current Project Structure

```
portfolio/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout — Geist font, metadata
│   │   ├── page.tsx            # Home page — R3F Canvas, lighting rig, placeholder overlay
│   │   ├── globals.css         # Global reset, CSS vars (#050505 bg, #f8fafc fg)
│   │   └── favicon.ico
│   └── components/
│       └── Head.tsx            # Interactive 3D head model (the only component)
├── public/
│   └── models/
│       └── head.glb            # Blender-exported GLTF with skeleton + BlinkAction
├── docs/
│   └── storyboard_v3.html      # The complete design spec
├── next.config.ts              # Empty config
├── tsconfig.json               # Strict mode, @/* path alias → ./src/*
├── eslint.config.mjs
└── package.json
```

The `src/` directory contains exactly two meaningful files right now: `page.tsx` and `Head.tsx`. There is no state management wiring, no scroll system, no HUD, no additional scenes. Everything beyond the head model is yet to be built.

---

## 2. What's Already Implemented

### `Head.tsx` — The Core 3D Component

This is the most complete and sophisticated piece of existing code. It implements:

**Geometry and Materials**
- Loads `head.glb` via `useGLTF`, creates a deep clone on mount (handles multi-instance safety)
- Rebuilds skeleton bindings manually on the clone so bone references point to cloned nodes, not originals
- Replaces the `Black`-named GLTF material with a flat unlit `MeshBasicMaterial` for the cartoon/comic aesthetic
- Applies `polygonOffset` to all mesh materials to push them back in the depth buffer, preventing Z-fighting with the wireframe overlay

**Sharp Edge Wireframe Overlay**
- `createSharpEdgeGeometry()` counts edge occurrences in the index buffer; edges appearing exactly once are boundary/hard edges (relies on Blender's Edge Split modifier output). Builds a `BufferGeometry` for `LineSegments`.
- The `LineSegments` are duck-typed as `SkinnedMesh` (`isSkinnedMesh`, `skeleton`, `bindMatrix`, `bindMatrixInverse`) so the WebGL renderer injects bone matrices into the custom skinning shader.
- Custom `ShaderMaterial` with `#include <skinning_pars_vertex>` / `#include <skinning_vertex>` for GPU-side bone deformation on the lines.
- Edge lines excluded for eyelash meshes (the topology doesn't suit it).

**Cursor / Gyroscope Tracking**
- On desktop: reads `state.pointer.x/y` from R3F's frame state (NDC -1 to 1).
- On mobile with gyroscope: `DeviceOrientationEvent` listener normalizes `beta` (pitch, centered at 45°) and `gamma` (yaw) to the same -1/1 range.
- Drives the `Head` bone (yaw/pitch) and `eyeL001`/`eyeR001` bones independently with different damping speeds via `dampQ` from `maath/easing` (head: 0.25, eyes: 0.08).
- Eye rotation is composed on top of cached rest quaternions so it doesn't accumulate drift.
- Bone references are lazily discovered once in the first `useFrame` call and cached in refs.

**Blink Animation**
- `THREE.AnimationMixer` on the cloned scene, plays the `BlinkAction` clip from the GLTF.
- The clip is filtered down to only lid/eyelash bone tracks before use (avoids driving other bones).
- `LoopOnce` + `clampWhenFinished = false` so each blink is a single shot.
- Random timer: 2000–6000ms intervals, 15% chance of double-blink (second play 200ms after first).

**Performance**
- Eyelashes hidden on `window.innerWidth < 768` via a resize listener.
- `frustumCulled = false` on all meshes (the head fills the viewport and clipping artifacts were visible).

### `page.tsx` — The Canvas Setup

- Orthographic-style perspective camera at `[0, 0, 10]` with `zoom: 20` — so the head fills the frame but isn't a true orthographic projection.
- Three lights: ambient (0.1 intensity), key spotlight (30 intensity from above-front, casts shadows), rim point light (10 intensity, behind-left).
- Shadow type: `THREE.PCFShadowMap` (chosen over the deprecated PCFSoft).
- A muted `console.warn` suppression for two deprecation notices from Three.js r183 (THREE.Clock, PCFSoftShadowMap).
- A placeholder overlay (`<div>`) with hardcoded "Portfolio" and "Work in progress" text.
- No Zustand store, no scroll system, no HUD.

### `globals.css`

- `overflow: hidden` on html/body — intended for the immersive experience where the page doesn't scroll natively.
- Dark background (`#050505`) matching the Canvas clear color.
- No Tailwind utilities in use yet (Tailwind v4 is installed but unused in CSS).

---

## 3. Dependencies Installed

### Production

| Package | Version | Status | Purpose |
|---|---|---|---|
| `next` | 16.1.6 | Active | Framework |
| `react` / `react-dom` | 19.2.3 | Active | UI |
| `three` | ^0.183.1 | Active | 3D engine |
| `@react-three/fiber` | ^9.5.0 | Active | React bindings for Three.js |
| `@react-three/drei` | ^10.7.7 | Partially used | Helpers — `useGLTF`, `Center` used; `Html`, `CatmullRomLine`, `RoundedBox` not yet |
| `maath` | ^0.10.8 | Active | `dampQ` for quaternion smoothing |
| `gsap` | ^3.14.2 | **Installed, unused** | Animations (lifecycle transitions, annotation fade-ins) |
| `lenis` | ^1.3.18-dev | **Installed, unused** | Smooth scroll driver |
| `zustand` | ^5.0.11 | **Installed, unused** | Global state (scrollT, chatMode, activeScene) |
| `tailwindcss` | ^4.2.1 | Installed, unused | CSS utilities |
| `@tailwindcss/postcss` | ^4.2.1 | Installed | PostCSS integration |
| `postcss` | ^8.5.6 | Installed | CSS processing |

### Dev

TypeScript 5, ESLint 9 + `eslint-config-next`, all `@types/*` packages.

### Notable Absences (need to be installed)

- **Mistral AI SDK** (`@mistralai/mistralai`) — needed for the chat backend API route. The storyboard references "MistralMsg" architecture.
- No test runner configured.
- `@react-three/postprocessing` — explicitly NOT needed per storyboard (no post-processing).

---

## 4. Storyboard v3 — Complete Scene Map

The storyboard's concept ("Latent Space") is: the head = a latent vector `z`. Scrolling is the decoder. The camera travels along an Archimedean spiral (2.5 revolutions, radius 2→45 Three.js units) around the head. Each scene occupies a different angular position on the spiral. The scroll progress `t` (0→1) is the authoritative state value.

### Core Architecture Needed Before Any Scene

**Scroll Driver (`src/hooks/useScroll.ts`)**
- Lenis is installed for smooth scroll. It should be initialized once and its `scroll` event mapped to a normalized `t` value (0→1).
- The storyboard explicitly says to avoid `drei ScrollControls` — use a raw wheel/touch listener that increments `t`.
- `overflow: hidden` is already set on body, so native scroll won't occur; `t` must be driven entirely by input events.
- Output: a Zustand store value `scrollT` that the camera system reads.

**Zustand Store (`src/store/useStore.ts`)**
- `scrollT: number` (0→1) — current position along the spiral
- `chatMode: boolean` — whether the 3D tablet is open
- `activeScene: number` (0–8) — derived from `scrollT`
- `userHasInteracted: boolean` — once true, auto-drift never fires again
- `chatHistory: Message[]` — chat messages for the tablet UI

**CatmullRom Spiral Path (`src/components/SceneManager.tsx` or a hook)**
- Generate ~60–80 control points along an Archimedean spiral: for each point `i`, angle = `i * (2.5 * 2π / N)`, radius = `lerp(2, 45, i/N)`, height varies gently (±2 units) for a helix feel.
- `CatmullRomCurve3` from Three.js wraps these points.
- In `useFrame`, sample `curve.getPoint(scrollT)` for camera position and `curve.getTangent(scrollT)` (or a per-scene focal point) for the look-at target.
- Each scene has a defined focal point in world space; camera lerps its look-at toward the current scene's focal point.

**Auto-Drift (`src/hooks/useAutoDrift.ts`)**
- After 3.5s of no input (no wheel, touch, pointermove), start incrementing `scrollT` at 0.5% per second.
- Any user input: clear the interval, set `userHasInteracted = true`, never drift again.
- This teaches the scroll mechanic without text.

**Persistent HUD (`src/components/HUD.tsx`)**
HTML overlay (`position: fixed`, `z-index` above canvas):
- Top-left: "RIAD BOUSSOURA" in Space Mono 9px. Click → `scrollT = 0`.
- Top-right: [CV] and [Chat] buttons. [Chat] sets `chatMode = true` from any scroll position.
- Right edge: vertical scene ticker (S-0 through S-8). Active scene highlighted. Click any → camera lerps along spiral.
- Bottom-left: `z = {scrollT.toFixed(3)}` — the latent coordinate counter. During chat: `z = CHAT_MODE`.
- Bottom-right (mobile only): floating [Chat] button with subtle 8s pulse animation, 44×44px minimum hit target.

---

### S-0: The Head — Extreme Close-Up
**Scroll range:** 0%–25% | **Priority:** MAX

**What's done:** The head model, cursor/gyro tracking, blink animation, wireframe overlay — all complete.

**Exact dimensions of the mesh from Blender:**
X: 0.289 m
Y: 0.359 m
Z: 0.507 m
NOTE: the head's origin is the nose tip.

**What needs to change/add:**

1. **Camera start position**: Currently `[0, 0, 10]` with zoom 20. For S-0, the storyboard wants the camera "inside the mesh's bounding sphere" — the head fills 80% of viewport, only one eye + cheek visible. The spiral path start point (radius ~2 from head center) handles this — the page.tsx camera setup will be replaced by the spiral camera system entirely.

2. **Annotations** (`src/components/Annotations.tsx`): 3 `<Html>` elements from `@react-three/drei` attached to specific vertex positions on the head mesh (e.g., cheekbone, eye socket, jawline). Each annotation is a short label with a thin SVG line extending from the attachment point to a text label. These animate in with 0.4s stagger on page load and fade out at 15% scroll progress. Uses GSAP for the stagger animation.

3. **Particle cloud** (`src/components/Particles.tsx`): 200 particles in a tight Gaussian cluster around the head. Pure black background + low-opacity white dots (`Points` geometry, `PointsMaterial`). They should extend further into space as the camera pulls back.

4. **Object lifecycle**: Annotations dispose (remove from DOM) at 25% scroll. The head itself is never disposed — it remains as a reference point throughout the entire journey, just growing smaller as the camera spirals out.

---

### S-1: GoPro — The Stitching Pipeline
**Scroll range:** Enter 8%–15%, Dwell 15%–30%, Exit 30%–42%, Dispose 50% | **Priority:** MAX

**New file:** `src/components/scenes/GoPro.tsx`

**3D objects to build (all procedural or low-poly GLTF):**
- **GoPro camera body**: A low-poly box/cylinder composite (~200 faces). Could be a simple `BoxGeometry` with `RoundedBox` from drei. Dual-lens circles on front face (two `CircleGeometry` or `CylinderGeometry` lenses).
- **Two equirectangular wireframe spheres**: `SphereGeometry` with `wireframe: true` or `EdgesGeometry` + `LineSegments`. Left sphere = "before" (dashed/dim), right sphere = "after" (brighter). Both rotate slowly (0.2 rad/s) during dwell.
- **Neural network graph**: A set of `Sphere` nodes at defined 3D positions, connected by `Line` primitives (drei `<Line>` or `THREE.Line`). Animated flow particles travel along the edges — small bright dots moving along the edge lines (parametric position on segments, updated in `useFrame`). The graph represents: [Blender synthetic data] → [PyTorch model] → [output stitched image].
- **Text panel**: `<Html>` from drei, positioned left of the GoPro. Shows ">50% speed improvement" headline, brief description, [GitHub] and [Write-up] links.

**Lifecycle implementation:**
- The entire scene group starts at `opacity = 0`, `position.x += 5`, `position.z += 3` (offset from final position).
- When `scrollT` crosses 8%, trigger a GSAP tween: `opacity 0→1` over 2s, position `+5,0,+3 → 0,0,0` with `easeOutCubic`.
- At 50% scroll: call `geometry.dispose()` + `material.dispose()` on all objects in this group. Remove from scene graph.

---

### S-2: Sorbonne — Research & Scholarship
**Scroll range:** Enter 25%–32%, Dwell 32%–44%, Exit 44%–52%, Dispose 60% | **Priority:** HIGH

**New file:** `src/components/scenes/Sorbonne.tsx`

**3D objects:**
- **3–4 paper planes**: Start as `PlaneGeometry` in a folded state (top half rotated ≈90° around the center fold line). On enter, animate the fold open to flat. Rendered with a light grey `MeshBasicMaterial` with slight transparency. Each plane has faint text-line geometry (thin `BoxGeometry` lines) representing title/abstract blocks — not readable text, just visual texture.
- **Neural architecture diagram**: A layered graph that assembles node-by-node. Nodes appear one at a time with a short glow flash (brief emissive spike). Edges draw themselves using animated `Line` geometry (progressively increasing the point count or moving an endpoint). Represents a research model architecture.
- **Scholarship medallion**: A `DodecahedronGeometry` or `IcosahedronGeometry` (faceted appearance). Slow Y-axis rotation during dwell. Material: `MeshStandardMaterial` with high metalness, low roughness. Floats above the paper arrangement.

---

### S-3: BargMe — CTO & Startup Leadership
**Scroll range:** Enter 40%, Dwell 45%–54%, Exit 54%, Dispose 65% | **Priority:** MED

**New file:** `src/components/scenes/BargMe.tsx`

**3D objects:**
- **Low-poly smartphone**: A `RoundedBoxGeometry` from drei (1.8 aspect ratio). Screen face has a `PlaneGeometry` with a `<Html>` showing a simplified barcode scanner UI.
- **Scanning beam**: A thin `PlaneGeometry` that translates up and down over the phone screen with a sine wave. Material: `MeshBasicMaterial` with red/green color and transparency.
- **Product shelf**: Three `BoxGeometry` objects side by side representing products. Keep extremely simple — this is a supporting scene.

---

### S-4: Google DevFest — 1st Prize + National TV
**Scroll range:** Enter 50%, Dwell 55%–66%, Exit 66%, Dispose 78% | **Priority:** HIGH

**New file:** `src/components/scenes/Hackathon.tsx`

**3D objects:**
- **Wireframe skeleton**: A hierarchy of `CylinderGeometry` bones connected at joints, representing a human figure in fall-detection pose. Uses `THREE.Group` hierarchy to allow pose animation. On enter, bones "assemble" one by one (each with a staggered opacity fade-in, building up the full figure).
- **Fall animation loop**: The skeleton tips from upright to falling during dwell. Drives joint rotations via `useFrame` with a looping time-based animation.
- **"OK" hand gesture**: A static hand shape next to the skeleton — simplified `CylinderGeometry` fingers in OK position.
- **Trophy fragments**: On first entering the scene (once per session), trigger a burst: 8–12 `BoxGeometry` or `TetrahedronGeometry` fragments fly outward from a center point with initial velocity vectors, then slow/fall due to a simulated gravity (manual Euler integration in `useFrame`). After the burst, they settle at rest positions.
- **Robot vacuum**: A low-poly disc (`CylinderGeometry`, very flat) that rolls in from below along the floor plane.

---

### S-5: Samsung Innovation Campus — ADAS
**Scroll range:** Enter 62%, Dwell 67%–76%, Exit 76%, Dispose 85% | **Priority:** MED

**New file:** `src/components/scenes/Samsung.tsx`

**3D objects:**
- **Low-poly car**: Either a very simple `BoxGeometry`-based composite (body + wheels) or a tiny GLTF (keep under 50KB Draco). Drives in from the void on enter.
- **Face mesh**: A `<Html>` element on the windshield plane showing a stylized face landmark grid — or a `Points` geometry with ~68 landmark points arranged in a face shape, connected by `Line` segments for the EAR (Eye Aspect Ratio) measurement lines.
- **EAR vectors**: Two bright line segments from outer eye corners to inner corners, with a numeric label showing the EAR value (0.28 or whatever the blink threshold was).
- **Jetson Nano board**: A flat `BoxGeometry` with PCB-green `MeshBasicMaterial`, small `BoxGeometry` chips on top. Floating beside the car.

---

### S-6: Origin — The PC, The Passion
**Scroll range:** Enter 74%, Dwell 78%–86%, Exit 86%, Dispose 92% | **Priority:** EMOTIONAL

**New file:** `src/components/scenes/Origin.tsx`

**3D objects:**
- **Low-poly gaming PC tower**: `BoxGeometry` frame + `BoxGeometry` components inside (visible through `EdgesGeometry` wireframe overlay). Tempered glass panel = a slightly-transparent `PlaneGeometry` on the side face.
- **Glowing screen**: A `PlaneGeometry` monitor. Material starts with `emissiveIntensity = 0`, animates up to 1.5 over 1.5s on enter. `RectAreaLight` in front of the screen provides actual scene illumination.
- **Orbiting Blender primitives**: 3–5 default Blender primitives (`TorusGeometry`, `IcosahedronGeometry`, `ConeGeometry`, `TorusKnotGeometry`) orbit around the PC at different radii and angular speeds. Materials: simple wireframe. This represents the Blender learning origin story.

---

### S-7: Art Portfolio Gallery
**Scroll range:** Enter 84%, Dwell 88%–94%, Exit N/A, Dispose on /art navigation | **Priority:** NEW

**New file:** `src/components/scenes/ArtGallery.tsx`

**3D objects:**
- **5–8 frames**: Each is a `BoxGeometry` with depth 0.02 and a slightly larger aspect ratio than 16:9. Material: `MeshStandardMaterial`, dark metal frame color. Each frame is at a slightly different depth, Y position, and rotation (±5° on X and Z) — arranged in a gentle arc.
- **Artwork thumbnails**: Each frame has a child `<Html>` from drei showing an `<img>` tag with a thumbnail from the art portfolio. The `<Html>` is positioned and sized to fill the inner area of the frame.
- **Hover interaction**: `onPointerEnter` → GSAP scale tween from 1→1.2. `onPointerLeave` → scale back to 1. On hover, a `<Html>` label appears below the frame with title + medium.
- **Spotlights**: One `PointLight` above each cluster of frames, very low intensity (0.3), warm white. Gives museum atmosphere.
- **"SELECTED WORKS" header**: A `<Html>` element above the gallery. Below: "[VIEW FULL GALLERY →]" linking to `/art`.
- **Click**: `onClick` → `router.push('/art')` (Next.js App Router navigation).

---

### S-8: Conversion — Re-encode to the Head
**Scroll range:** Enter 94%, Dwell 94%–100% | **Priority:** CONVERT

**New file:** `src/components/scenes/Conversion.tsx`

**Behavior:**
- Camera drifts back toward the head center (the spiral's start point) — `scrollT` wraps back, or a separate camera tween overrides the spiral.
- All previous scenes are now visible as miniature dioramas scattered along the spiral behind the camera — rendered at reduced scale, naturally far away and dim.
- Three floating CTA tiles (each a `<Html>` positioned in 3D space, or styled `<div>` elements in the HUD):
  - **[→ CHAT WITH RIAD]** — primary, triggers `chatMode = true`
  - **[→ DOWNLOAD CV]** — secondary, links to PDF
  - **[→ VIEW ART GALLERY]** — tertiary, links to /art
  - **[→ LINKEDIN / GITHUB]** — quaternary, icon links
- Text: "R&D Engineer — Computer Vision & AI. Paris. Available now."
- CTA tiles have a subtle pulse animation on enter.

---

### 3D Tablet Chat UI
**Trigger:** `chatMode = true` (from [Chat] HUD button or S-8 CTA) | **Priority:** HIGH (Week 3 in build plan)

**New files:**
- `src/components/Tablet.tsx` — the 3D object + chat HTML
- `src/app/api/chat/route.ts` — Mistral API streaming endpoint

**`Tablet.tsx` implementation:**
1. **Tablet body**: `RoundedBoxGeometry` (available in drei) — dimensions 1.8 × 1.2 × 0.06. `MeshStandardMaterial` with `roughness: 0.85`, `metalness: 0.1`, `color: #111`. Tilts 8° toward the camera.
2. **Screen plane**: A separate `PlaneGeometry` child mesh at `z + 0.031` (front face, slightly proud). No material — it's purely the anchor for the `<Html>` component.
3. **Screen content** (`<Html>`): Renders the full chat interface as regular HTML/CSS inside the drei Html portal. Contains:
   - Header: "ASK RIAD — AI CLONE" in Space Mono
   - Suggested prompt chips (top of chat area)
   - Message history (scrollable)
   - Input field + send button
4. **Screen glow**: `RectAreaLight` in front of the screen, intensity 0.15, white.
5. **Floating prompt chips**: 4 `<Html>` elements positioned in 3D space at ±30° angles from the tablet. They bob with `Math.sin(clock.elapsedTime * Math.PI) * 0.3` on Y. On click: animate scale to 0 over 0.3s, send the prompt text to the chat, all other chips also scale to 0.
6. **Camera transition**: When `chatMode` becomes true, GSAP tweens the camera position from current scroll position to `chatCameraPosition` (pre-defined world coordinate) over 1.2s with `easeInOutCubic`. Scroll control disabled while `chatMode = true`.
7. **Tablet entrance**: Scales from 0→1 with a spring overshoot (GSAP elastic ease or a custom spring in `useFrame`) as camera arrives.
8. **Exit**: ESC key or ← button → tablet scales to 0 over 0.3s, camera lerps back to `scrollT` position over 0.8s, `chatMode = false`.
9. **Mobile**: On `window.innerWidth < 768`, the tablet scales up to fill the screen and the background dims to near-black. No floating chips (they're too small to tap).

**`src/app/api/chat/route.ts`:**
- Next.js Route Handler using streaming (`ReadableStream` + `Response`).
- Calls Mistral API with `stream: true`.
- System prompt contains: structured CV, GoPro project writeup, availability, preferred roles, personality voice.
- Rate limiting should be considered (simple: IP-based counter in edge middleware or Vercel KV).

---

## 5. Files That Need to Be Created

### Hooks
- `src/hooks/useScroll.ts` — Lenis scroll driver → normalized `t` (0→1). Writes to Zustand `scrollT`.
- `src/hooks/useAutoDrift.ts` — Idle detection + auto-drift logic. Reads/writes `scrollT` and `userHasInteracted`.
- `src/hooks/useChatAPI.ts` — Fetch/stream wrapper for `/api/chat`.

### Store
- `src/store/useStore.ts` — Zustand store: `scrollT`, `chatMode`, `activeScene`, `userHasInteracted`, `chatHistory`.

### Components (3D, live inside Canvas)
- `src/components/SceneManager.tsx` — CatmullRomCurve3 spiral, camera position sampling, scene visibility management, frustum-based lifecycle hooks.
- `src/components/Particles.tsx` — 200-point Gaussian particle cloud.
- `src/components/Annotations.tsx` — S-0 annotation lines attached to head vertices via drei `<Html>`.
- `src/components/Tablet.tsx` — 3D tablet with embedded chat UI.
- `src/components/scenes/GoPro.tsx`
- `src/components/scenes/Sorbonne.tsx`
- `src/components/scenes/BargMe.tsx`
- `src/components/scenes/Hackathon.tsx`
- `src/components/scenes/Samsung.tsx`
- `src/components/scenes/Origin.tsx`
- `src/components/scenes/ArtGallery.tsx`
- `src/components/scenes/Conversion.tsx`

### Components (HTML, outside Canvas)
- `src/components/HUD.tsx` — Persistent overlay: name, CTAs, scene ticker, z-counter, mobile chat button.

### API
- `src/app/api/chat/route.ts` — Mistral streaming chat endpoint.

### Pages
- `src/app/art/page.tsx` — Art portfolio gallery page (full-page, linked from S-7 and S-8).

---

## 6. Key Technical Decisions from the Storyboard

**Scroll system**: Do NOT use `@react-three/drei`'s `ScrollControls`. Use Lenis (already installed) as a smooth-scroll driver with a custom mapping from its progress to a `t` value. Lenis normalizes inertia across devices. The `overflow: hidden` on body means no native scroll bar — Lenis still captures wheel + touch events.

**Camera**: Replace the current static `camera={{ position: [0, 0, 10], zoom: 20 }}` in `page.tsx` with an imperative camera driven by the spiral path. In `useFrame`, call `camera.position.copy(curve.getPoint(scrollT))` and `camera.lookAt(focalPoint)`. Use R3F's `useThree()` to access the camera imperatively.

**Object lifecycle**: Each scene component receives `scrollT` as a prop (or reads from Zustand). It manages its own visibility, opacity, and geometry disposal based on scroll thresholds. GSAP is the right tool for the enter/exit tweens (not CSS, since these drive Three.js uniform values and object positions).

**No post-processing**: `@react-three/postprocessing` is not installed and should not be added. The aesthetic is raw wireframe on black — no bloom, no SSAO, no DOF. This is the single biggest mobile performance win per the storyboard.

**drei `<Html>` usage**: Will be used heavily — for S-0 annotations, tablet screen content, scene text panels, art gallery labels, floating prompt chips. The `transform` prop on `<Html>` projects the HTML into 3D space. The `occlude` prop can hide it when behind geometry.

**Frustum culling**: For scenes S-1 through S-7, set `frustumCulled: true` (Three.js default) on the scene group — do NOT disable it like `Head.tsx` does for the head. The spiral path means previous scenes naturally fall behind the camera, and Three.js culls them for free. Active geometry disposal (calling `.dispose()`) happens at the scroll thresholds defined per scene.

**Fonts**: The storyboard uses Space Mono, Bebas Neue, and DM Sans. These are Google Fonts — they should be added to `layout.tsx` via `next/font/google` (same pattern as Geist is already used). The HUD and scene text panels depend on these.

**Chat backend**: The storyboard references a "MistralMsg" architecture that presumably already exists elsewhere. The implementation is a streaming Next.js route handler. Requires installing `@mistralai/mistralai`.

---

## 7. Build Priority (from Storyboard § 07)

| Phase | Week | Deliverable |
|---|---|---|
| 1 | 1 | Head close-up + annotations + HUD + auto-drift + spiral camera path (no scene objects, just the head pulling away into void). Deploy. |
| 1 | 2 | S-1 GoPro scene: full 3D objects, object lifecycle, frustum culling test. |
| 1 | 3 | 3D tablet chat UI + Mistral API route + system prompt. Deploy. Apply to jobs. |
| 2 | 4 | S-2 Sorbonne + S-4 Hackathon (HIGH priority scenes). |
| 2 | 5 | S-3 BargMe + S-5 Samsung (MED priority). |
| 2 | 6 | S-6 Origin + S-7 Art Gallery + S-8 Conversion. |
| Ongoing | — | Polish animations, add art pieces to gallery, refine chat system prompt. |
