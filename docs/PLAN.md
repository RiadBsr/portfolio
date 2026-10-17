# Implementation Plan

Three phases. Each phase ends with a deployable state. No code is written until the plan is agreed upon.

---

## Phase 1 — Head Scene + Spiral Camera + HUD

**Goal:** The visitor lands on an extreme close-up of the head. After 3.5 seconds of inactivity the camera begins drifting backward along a spiral. Scrolling/swiping takes over manual control. Annotations appear on the face at the start and fade out as the camera pulls away. A persistent HUD shows the name, CTAs, scene ticker, and z-coordinate. At the end of the spiral the camera is far from the head and the void stretches out — ready for scene objects in Phase 2.

### Step 1 — Zustand Store

**File:** `src/store/useStore.ts`

Create the global store that every other component reads from. Initial shape:

```
scrollT: number           // 0 → 1, normalized scroll progress
activeScene: number       // derived from scrollT thresholds
chatMode: boolean         // false (Phase 3)
userHasInteracted: boolean // false until first scroll/touch
```

Actions: `setScrollT`, `setChatMode`, `setUserHasInteracted`. `activeScene` is computed — not stored — via a selector that maps `scrollT` ranges to scene indices (0–8).

No other file depends on this store yet, so it can be built and tested in isolation.

### Step 2 — Scroll Driver

**File:** `src/hooks/useScroll.ts`

Wire Lenis to capture wheel and touch events on the `<main>` element. Lenis is already installed (`lenis@^1.3.18-dev.0`). Because `overflow: hidden` is set on `<body>`, there is no native scrollbar — Lenis operates in "virtual scroll" mode.

Responsibilities:
- Initialize a Lenis instance in a `useEffect` on mount.
- On each Lenis `scroll` callback, compute a delta and add it to a local accumulated value. Clamp the result to [0, 1]. Write it to the store via `setScrollT`.
- On the first wheel/touch/pointermove event, call `setUserHasInteracted(true)`.
- Clean up (destroy Lenis) on unmount.
- Expose nothing — this hook is side-effect only. It is called once from `page.tsx`.

**Important:** When the store's `chatMode` is true, the scroll driver must ignore all input (scroll is disabled during chat).

### Step 3 — Auto-Drift

**File:** `src/hooks/useAutoDrift.ts`

A `useEffect` hook that starts a `requestAnimationFrame` loop 3.5 seconds after mount. On each frame, if `userHasInteracted` is still false, increment `scrollT` by `0.005 * deltaSeconds`. The moment `userHasInteracted` flips true, cancel the loop permanently.

Called once from `page.tsx`, right next to `useScroll`.

### Step 4 — Spiral Camera Path

**File:** `src/components/SpiralCamera.tsx`

A component rendered inside the R3F `<Canvas>`. It uses `useFrame` + `useThree` to imperatively drive the camera every frame.

Responsibilities:

1. **Build the spiral curve once** (in a `useMemo`). Generate ~80 control points on an Archimedean spiral:
   - For point `i` of `N`: angle = `i / N * 2.5 * 2π`, radius = `lerp(2, 45, i / N)`, y = `sin(angle * 0.3) * 2` (gentle vertical undulation).
   - Wrap in `new THREE.CatmullRomCurve3(points)`.

2. **Define a focal-points array.** One `THREE.Vector3` per scene (S-0 through S-8). S-0's focal point is the head center `(0, 0, 0)`. Future scenes get theirs set in Phase 2+. For now only S-0's matters.

3. **In `useFrame`:** read `scrollT` from the store. Sample `curve.getPoint(scrollT)` → set `camera.position`. Determine which scene is active. Smoothly interpolate `camera.lookAt` toward the active scene's focal point using `dampE` or `dampV3` from `maath/easing` (not a hard snap — the look-at must feel cinematic). Call `camera.updateProjectionMatrix()` if needed.

4. **Chat mode override:** when `chatMode` is true, lerp camera to a fixed `chatCameraPosition` instead of the spiral point. (The lerp target is defined but the chat trigger doesn't exist until Phase 3. For now, `chatMode` is always false.)

**Changes to `page.tsx`:**
- Remove the declarative `camera={{ position: [0, 0, 10], zoom: 20 }}` prop from `<Canvas>`. Instead, set `camera={{ fov: 50, near: 0.1, far: 200 }}` (perspective, not the quasi-orthographic setup used today).
- Remove `<Center>` wrapping the head — the head sits at world origin `(0,0,0)` and the camera orbits it.
- Add `<SpiralCamera />` inside the Canvas.

### Step 5 — Particles

**File:** `src/components/Particles.tsx`

A component rendered inside the Canvas. Creates a `THREE.Points` mesh:

- 200 points, positions sampled from a 3D Gaussian distribution centered at `(0, 0, 0)` with σ ≈ 5 (tight cluster around head, thinning outward).
- `PointsMaterial` with `color: white`, `size: 0.05`, `transparent: true`, `opacity: 0.15`, `sizeAttenuation: true`.
- No animation needed — the particles are static. The camera moving through them provides all the visual motion.

Frustum culling stays enabled (default). No dispose logic — particles persist for the entire session.

### Step 6 — Annotations

**File:** `src/components/Annotations.tsx`

Three annotation labels attached to the head mesh surface using drei `<Html>`. Each annotation is:

- A thin SVG line (2px, white, 20% opacity) from the attachment point outward at an angle, ending at a text label.
- The text label: a short phrase in Space Mono 9px (e.g., "Neural mesh", "Edge detection", "Bone rigging").
- Attachment points: fixed world-space positions near the head surface (e.g., `[0.3, 0.5, 0.8]` for cheekbone, `[-0.2, 0.8, 0.6]` for eye socket, `[0.1, -0.3, 0.7]` for jawline). These are static — they don't need to track bones.

Behavior driven by `scrollT` from the store:
- At `scrollT = 0`: invisible (opacity 0). After a 0.5s delay, animate in with 0.4s stagger per annotation using GSAP (the `@gsap/react` hook `useGSAP` is available).
- At `scrollT > 0.15`: fade out (GSAP tween opacity → 0 over 0.5s).
- At `scrollT > 0.25`: unmount entirely (conditional render, `return null`). This removes the drei `<Html>` portals from the DOM.

### Step 7 — HUD

**File:** `src/components/HUD.tsx`

A React component rendered **outside** the Canvas (sibling `<div>` in `page.tsx`). Positioned with `position: fixed; inset: 0; pointer-events: none; z-index: 10`. Child elements get `pointer-events: auto` individually.

Sub-elements:

1. **Top-left — Name:** "RIAD BOUSSOURA" in Space Mono 9px, letter-spacing 0.22em, `color: rgba(255,255,255,0.12)`. `onClick` → `setScrollT(0)`.

2. **Top-right — CTAs:** Two small buttons: [CV] (link to PDF, `target="_blank"`) and [Chat] (sets `chatMode = true`; disabled until Phase 3, render as greyed out or hidden for now).

3. **Right edge — Scene ticker:** Vertical list of scene labels. The active scene (derived from `scrollT`) is highlighted (brighter text or a small dot). `onClick` on any label → `setScrollT` to that scene's midpoint scroll value. For Phase 1, only S-0 has content; the rest are placeholders or hidden.

4. **Bottom-left — Z-counter:** `z = {scrollT.toFixed(3)}` in Space Mono 10px, `color: rgba(255,255,255,0.08)`.

5. **Bottom-right (mobile) — Chat button:** `display: none` until Phase 3.

### Step 8 — Font + Layout Updates

**File:** `src/app/layout.tsx` (edit)

Add the three storyboard fonts via `next/font/google`:
- `Space_Mono` → `--font-space-mono`
- `Bebas_Neue` → `--font-bebas`
- `DM_Sans` → `--font-dm-sans`

Keep Geist/Geist_Mono for now (they may be useful for code-like text). Apply all font variables to `<body>`.

**File:** `src/app/globals.css` (edit)

Add CSS custom properties matching the storyboard's design tokens:
```
--black: #030303;
--white: #F2F2EE;
--grey: #111;
--mid: #4A4A4A;
--wire: rgba(255,255,255,0.10);
--accent: #E0E0D8;
```

**File:** `src/app/page.tsx` (edit)

Major rewrite:
- Remove the placeholder overlay `<div>`.
- Change `<Canvas>` camera prop to `{ fov: 50, near: 0.1, far: 200 }`.
- Remove `<Center>` wrapper around `<HeadModel>`.
- Add `<SpiralCamera />`, `<Particles />`, `<Annotations />` inside Canvas.
- Add `<HUD />` as a sibling outside Canvas.
- Call `useScroll()` and `useAutoDrift()` at the top of the component.
- Keep the existing lighting rig for now (it illuminates the head at close range; as the camera pulls back, the head naturally dims — which is the intended effect).

### Phase 1 Implementation Order

```
1. src/store/useStore.ts          — store, no dependencies
2. src/hooks/useScroll.ts         — depends on store
3. src/hooks/useAutoDrift.ts      — depends on store
4. src/components/SpiralCamera.tsx — depends on store, renders in Canvas
5. src/app/layout.tsx             — edit: add fonts
6. src/app/globals.css            — edit: add design tokens
7. src/components/Particles.tsx   — standalone, renders in Canvas
8. src/components/Annotations.tsx — depends on store + GSAP, renders in Canvas
9. src/components/HUD.tsx         — depends on store, renders outside Canvas
10. src/app/page.tsx              — edit: wire everything together
```

Steps 1–3 have no visual output but can be verified via console logs. Step 4 is the first visual milestone — the camera should orbit from close-up to far-away as you scroll. Steps 5–6 are quick edits. Steps 7–8 add visual polish. Step 9 adds the UI overlay. Step 10 ties it all together.

### Phase 1 Verification Checklist

- [ ] Page loads with camera extremely close to head (one eye + cheek visible)
- [ ] After 3.5s of idle, camera starts drifting backward along the spiral
- [ ] Scrolling/swiping takes manual control; auto-drift never returns
- [ ] Annotations fade in on load with stagger, fade out by scrollT > 0.15, unmount by 0.25
- [ ] Particles visible as dim white specks, camera moves through them
- [ ] HUD shows name (top-left), z-counter (bottom-left), scene ticker (right)
- [ ] z-counter increments from 0.000 to 1.000 as you scroll
- [ ] Camera look-at smoothly tracks the head at the origin throughout the spiral
- [ ] Mobile: touch/swipe drives scroll, gyro still controls head look-around
- [ ] `npm run build` succeeds with no errors

---

## Phase 2 — GoPro Scene with Object Lifecycle

**Goal:** The first real content scene. As the camera spirals past S-0, the GoPro scene's objects drift in from the fog, reach full visibility, then fall behind the camera and get culled. This validates the entire lifecycle system (enter → dwell → exit → dispose) that every future scene will reuse.

### Step 1 — Scene Lifecycle Hook

**File:** `src/hooks/useSceneLifecycle.ts`

A reusable hook that every scene component will call. Accepts a config:

```
{
  enterStart: number,   // scrollT when enter begins (e.g., 0.08)
  enterEnd: number,     // scrollT when enter completes (e.g., 0.15)
  exitStart: number,    // scrollT when exit begins (e.g., 0.30)
  disposeAt: number,    // scrollT when geometry should be freed (e.g., 0.50)
}
```

Returns:

```
{
  phase: 'idle' | 'entering' | 'dwelling' | 'exiting' | 'disposed',
  enterProgress: number,  // 0→1 within the enter window
  visible: boolean,       // false when idle or disposed
  shouldMount: boolean,   // false only when disposed (component unmounts entirely)
}
```

Reads `scrollT` from the store. The calling component uses `phase` and `enterProgress` to drive its GSAP tweens and visibility. When `phase` becomes `'disposed'`, the calling component returns `null` (unmounts), which tears down all Three.js objects via React cleanup.

### Step 2 — Scene Focal Points

**File:** `src/components/SpiralCamera.tsx` (edit)

Add the S-1 focal point to the focal-points array. This is the world-space position where the GoPro scene's objects will be placed. Calculate it by sampling the spiral curve at `scrollT = 0.22` (midpoint of S-1's dwell range) and offsetting slightly toward the camera's forward direction so the objects appear "in front" of the camera at that point on the spiral.

Also add a `scenePositions` export: a map from scene index to `THREE.Vector3` that scene components import to know where to place themselves in world space.

### Step 3 — GoPro Scene

**File:** `src/components/scenes/GoPro.tsx`

A `<group>` rendered inside the Canvas, positioned at `scenePositions[1]`. All child objects are relative to this group.

**Internal structure:**

1. **GoPro Max 2 Camera.** Render the imported low-poly `gopro` GLTF model at the center of the scene.

2. **FRNT and BACK Half-Spheres.** Use the imported `FRNT` and `BACK` half-sphere models. They animate to close around the central camera. 
   - Apply the **same wireframe visual effect** as the first scene's head (e.g., using `createSharpEdgeGeometry` combined with a custom wireframe shader overlay).
   - Render the `360.jpg` texture on the FRNT half-sphere.
   - Render the `360_unaligned.jpg` texture on the BACK half-sphere initially, so the misaligned seam is visibly pronounced at the equator.

3. **Stitching Animation & Patch.** A patch-like square geometry passes along the equator/stitch line of the combined spheres. 
   - A custom shader on the BACK half-sphere reads the patch's sweep progression.
   - As the patch sweeps over the seam, the shader gradually interpolates the BACK's texture from `360_unaligned.jpg` to `360.jpg` (the perfect continuation).
   - Once the sweep completes, the visible stitch/seam disappears completely.

4. **Text panel.** drei `<Html>` positioned to the left of the group. Contains:
   - Headline: "Dual Fisheye 360 image stitching using DeepLearning" in Bebas Neue
   - Subtext: Brief description of the patch-based stitching pipeline and alignment strategy (>50% Speed Improvement)
   - Links: [GitHub] [Write-up] (placeholder hrefs for now)
   - Font: DM Sans for body, Space Mono for labels
   - All styled with the storyboard's color tokens

**Lifecycle wiring:**

- Call `useSceneLifecycle({ enterStart: 0.08, enterEnd: 0.15, exitStart: 0.30, disposeAt: 0.50 })`.
- If `shouldMount` is false, return `null`.
- During `entering` phase: GSAP-animate the group's position from `(+5, 0, +3)` offset to `(0, 0, 0)` local. Use `enterProgress` as the driver.
- During `dwelling`: Half-spheres close in around the camera, patch sweeps along the stitch line, and BACK texture seamlessly updates via uniform driver. Text is fully readable.
- During `exiting`: Camera spirals past. Objects naturally fall behind FOV (frustum culled).
- At `disposed`: component unmounts → React cleanup runs.

### Step 4 — Verify Frustum Culling

**No new file.** Verify by adding a temporary `useFrame` log in `GoPro.tsx` that prints `mesh.visible` for the group — it should become `false` once the camera turns past 30% scroll. Confirm GPU draw call count drops (via browser's WebGL inspector or R3F's `<Stats>` from drei).

### Phase 2 Implementation Order

```
1. src/hooks/useSceneLifecycle.ts   — reusable hook, depends on store
2. src/components/SpiralCamera.tsx  — edit: add S-1 focal point + scenePositions export
3. src/components/scenes/GoPro.tsx  — the scene, depends on lifecycle hook + SpiralCamera positions
4. src/app/page.tsx                 — edit: add <GoPro /> inside Canvas
5. Verify frustum culling           — temporary debug, then remove
```

### Phase 2 Verification Checklist

- [ ] Scrolling past 8%, GoPro objects drift in from offset position
- [ ] At 15%, objects fully visible — text readable, spheres rotating, flow dots animating
- [ ] At 30%+, camera turns away — objects leave viewport naturally
- [ ] At 50%, component unmounts (verify via React DevTools or a useEffect cleanup log)
- [ ] GPU draw calls drop after culling (verify via Stats or WebGL inspector)
- [ ] The lifecycle hook is generic — could be called by any future scene with different thresholds
- [ ] Mobile: scene renders correctly, text panel is readable on small screens
- [ ] `npm run build` succeeds

---

## Phase 3 — 3D Tablet Chat

**Goal:** Clicking [Chat] anywhere summons a floating tablet in 3D space. The tablet's screen shows a real chat interface powered by a Mistral API backend. Suggested prompts float around the tablet. ESC dismisses it. This is the conversion centerpiece.

### Step 0 — Install Mistral SDK

```
npm install @mistralai/mistralai
```

Add `MISTRAL_API_KEY` to `.env.local` (gitignored).

### Step 1 — Chat API Route

**File:** `src/app/api/chat/route.ts`

A Next.js Route Handler (POST). Accepts `{ messages: { role: string, content: string }[] }` in the request body.

Responsibilities:
- Read `MISTRAL_API_KEY` from `process.env`.
- Construct the Mistral API call with `stream: true`.
- System prompt: a carefully written persona prompt containing Riad's structured CV, GoPro project details, availability, preferred roles, and a conversational but professional tone. The system prompt text lives in a separate constant at the top of the file (or a dedicated `src/lib/systemPrompt.ts` if it's long).
- Return a streaming `Response` using a `ReadableStream` that forwards Mistral's SSE chunks as they arrive.
- Basic error handling: if the API call fails, return a non-streaming JSON error with an appropriate status code.

### Step 2 — Chat Hook

**File:** `src/hooks/useChat.ts`

A hook that manages client-side chat state and streaming.

State:
- `messages: { role: 'user' | 'assistant', content: string }[]`
- `isStreaming: boolean`
- `error: string | null`

Actions:
- `sendMessage(text: string)`: append a user message, call `fetch('/api/chat', ...)` with the full message history, read the response stream chunk by chunk, append/update the assistant message in real-time as tokens arrive.
- `clearChat()`: reset messages to empty.

This hook is consumed by the Tablet component.

### Step 3 — Tablet Component

**File:** `src/components/Tablet.tsx`

Rendered inside the Canvas. Only mounts when `chatMode` is true (conditional render in `page.tsx`).

**3D structure:**

1. **Tablet body.** drei `<RoundedBox args={[1.8, 1.2, 0.06]} radius={0.03} smoothness={4}>` with `MeshStandardMaterial { color: '#111', roughness: 0.85, metalness: 0.1 }`. Tilted 8° toward camera on X axis.

2. **Screen plane.** A child `<mesh>` with `<planeGeometry args={[1.65, 1.05]} />` at local z = 0.031. This mesh is the anchor for the `<Html>` overlay.

3. **Screen glow.** A `<rectAreaLight>` positioned at the screen plane, facing outward. `intensity: 0.15`, `width: 1.65`, `height: 1.05`, `color: white`. Provides a soft glow on the tablet body and nearby particles.

4. **Chat HTML.** drei `<Html transform occlude>` attached to the screen plane. Renders a `<ChatScreen />` sub-component (regular React, described below).

5. **Floating prompt chips.** 4 drei `<Html>` elements at ±30° angles around the tablet, each ~0.5 units away. Each chip: a bordered span with a suggested prompt text. They bob on Y using `Math.sin(clock.elapsedTime + offset) * 0.15` in a `useFrame`. On click: call `sendMessage(chipText)`, then GSAP-animate all chips' scale to 0 over 0.3s and remove them.

**Entrance/exit animation:**
- On mount: the group starts at `scale: [0, 0, 0]`. GSAP tween to `scale: [1, 1, 1]` with `elastic.out(1, 0.5)` ease over 0.8s.
- On unmount (chatMode goes false): before unmounting, GSAP tween scale to 0 over 0.3s. Use a local `isExiting` ref to delay the actual unmount until the animation completes. (Or use `gsap.to` with `onComplete` to set `chatMode = false` in the store after the tween.)

**Mobile adaptation:**
- On `window.innerWidth < 768`: tablet scales larger (fills ~90% of viewport), no floating chips (prompt chips render inside the HTML chat screen instead), background dims via a semi-transparent black plane behind the tablet.

### Step 4 — Chat Screen (HTML inside Tablet)

**File:** `src/components/ChatScreen.tsx`

A standard React component (not a 3D component). It renders inside the drei `<Html>` portal, so it's regular DOM. Styled with Tailwind or inline styles.

Structure:
- **Header bar:** "ASK RIAD — AI CLONE" with a colored dot indicator and [ESC] button.
- **Prompt chips row** (only shown when `messages` is empty): 3–4 clickable chips with recruiter-optimized text: "Tell me about GoPro", "What are you looking for?", "Your availability?", "3D + AI background". On click: calls `sendMessage`.
- **Message list:** Scrollable container. User messages right-aligned with subtle background. Assistant messages left-aligned with a left border accent. Assistant messages render with markdown support (bold, line breaks at minimum).
- **Input bar:** Text input + send button. On submit: calls `sendMessage`. Disabled while `isStreaming` is true (show a pulsing indicator in the send button).

### Step 5 — Camera Chat Position

**File:** `src/components/SpiralCamera.tsx` (edit)

Add chat mode camera logic:
- Define `chatCameraPosition` as a `THREE.Vector3` positioned ~4 units from the origin, slightly offset to the right and angled so the tablet (placed ~3 units from camera) and the head (in the background, distant) are both in frame.
- Define `chatLookAt` as a point midway between the tablet and the head.
- When `chatMode` becomes true: use `gsap.to` to tween camera position from current spiral point to `chatCameraPosition` over 1.2s with `easeInOutCubic`. Also tween the look-at target.
- When `chatMode` becomes false: tween back to `curve.getPoint(scrollT)` over 0.8s.
- While `chatMode` is true: skip the normal spiral position/lookAt logic in `useFrame`.

### Step 6 — Store + HUD Updates

**File:** `src/store/useStore.ts` (edit)

Add `chatHistory` state if the chat hook doesn't manage it internally. Add any actions needed for chat mode toggling.

**File:** `src/components/HUD.tsx` (edit)

- Enable the [Chat] button (previously greyed out / hidden). On click: `setChatMode(true)`.
- When `chatMode` is true: change the z-counter text to `z = CHAT_MODE`. Optionally dim or hide the scene ticker.
- Enable the mobile [Chat] button (bottom-right) with the 8-second pulse animation.
- Add keyboard listener: ESC key → `setChatMode(false)`.

### Step 7 — Wire Into Page

**File:** `src/app/page.tsx` (edit)

- Add conditional `<Tablet />` render inside Canvas: `{chatMode && <Tablet />}`.
- Read `chatMode` from store to pass as a flag (or the Tablet reads it directly).

### Phase 3 Implementation Order

```
0. npm install @mistralai/mistralai + .env.local
1. src/app/api/chat/route.ts        — API route, test with curl
2. src/hooks/useChat.ts             — streaming hook, test with a throwaway UI
3. src/components/ChatScreen.tsx     — HTML chat UI, test standalone before embedding
4. src/components/Tablet.tsx         — 3D tablet + Html portal + prompt chips
5. src/components/SpiralCamera.tsx   — edit: chat camera position + lerp logic
6. src/store/useStore.ts             — edit: any new state for chat
7. src/components/HUD.tsx            — edit: enable [Chat] button, ESC key, mobile button
8. src/app/page.tsx                  — edit: mount <Tablet />, verify integration
```

Steps 1–3 can be developed and tested independently of the 3D scene. Step 1 is testable with curl/Postman. Steps 2–3 can be tested in a temporary `<div>` overlay before being embedded in the tablet. Step 4 is where 3D and HTML merge. Steps 5–7 are integration edits. Step 8 is final wiring.

### Phase 3 Verification Checklist

- [ ] `POST /api/chat` with a messages array returns a streaming text response
- [ ] Streaming tokens appear in the chat UI in real-time (not all at once)
- [ ] Clicking [Chat] in HUD: camera smoothly lerps to chat position over 1.2s
- [ ] Tablet materializes with spring animation during the camera move
- [ ] Prompt chips float and bob around the tablet
- [ ] Clicking a prompt chip sends the message and all chips disappear
- [ ] Typing a message and pressing Enter sends it; response streams in
- [ ] Pressing ESC: tablet shrinks away, camera returns to previous scroll position
- [ ] z-counter shows "CHAT_MODE" while chatting
- [ ] Scroll is disabled during chat mode
- [ ] Head is visible in the background during chat, slowly rotating
- [ ] Mobile: tablet fills screen, no floating chips, prompt chips are inline
- [ ] Mobile: [Chat] button visible in bottom-right thumb zone
- [ ] API errors show a user-friendly message in the chat, not a crash
- [ ] `npm run build` succeeds
- [ ] `.env.local` is in `.gitignore`

---

## Phase 4 — Art Portfolio Gallery (S-7 Scene + `/art` Page)

**Goal:** The outermost ring of the spiral becomes a museum. As the camera reaches ~84% scroll, framed artworks arc into view under low warm spotlights. A "SELECTED WORKS" header floats above them with a "[VIEW FULL GALLERY →]" link. Clicking any frame or the link navigates to a dedicated full-page `/art` gallery — a scrollable, lightboxed grid that lives outside the Canvas. This is the first scene that breaks the single-page model by routing to a real Next.js page.

### Step 1 — Art Asset Manifest

**Files:** `public/art/` (images), `src/lib/artworks.ts`

- Drop artwork images + thumbnails into `public/art/` (e.g. `public/art/thumb/`, `public/art/full/`).
- `src/lib/artworks.ts` exports a typed array:
  ```
  { id: string, title: { en: string, fr: string }, medium: { en: string, fr: string },
    year: number, thumb: string, full: string }
  ```
  Title/medium are localized objects so Phase 5 can read them directly (no schema change later).
- Single source of truth — both the S-7 scene and the `/art` page import this list.

### Step 2 — ArtGallery Scene (S-7)

**File:** `src/components/scenes/ArtGallery.tsx`

A `<group>` rendered inside the Canvas, positioned at the S-7 scene position. Follows the standard outer-guard / inner-renderer split.

- **Lifecycle:** `useSceneLifecycle({ enterStart: 0.84, enterEnd: 0.88, exitStart: 0.94, disposeAt: 0.99 })`. Return `null` when `shouldMount` is false.
- **Frames:** 5–8 `BoxGeometry` frames (depth 0.02, slightly wider than 16:9), `MeshStandardMaterial` dark-metal color, arranged in a gentle arc with ±5° X/Z rotation and small depth/Y jitter. Preserve `polygonOffset` on materials per project convention.
- **Thumbnails:** each frame holds a child drei `<Html>` with an `<img>` from `artworks.ts`, sized to fill the inner frame.
- **Hover:** `onPointerEnter` → GSAP scale 1 → 1.2 and call `pupilDilate()`; `onPointerLeave` → scale back + `pupilContract()` (ref-counted, per CLAUDE.md). On hover a `<Html>` label appears below the frame with title + medium.
- **Spotlights:** one low-intensity (0.3) warm-white `PointLight` per frame cluster for museum atmosphere.
- **Header:** a `<Html>` "SELECTED WORKS" above the gallery, with "[VIEW FULL GALLERY →]" linking to `/art` (use Next `useRouter().push('/art')`).
- **Click:** `onClick` on a frame → `router.push('/art')` (optionally `?id=<id>` to deep-link the lightbox).

### Step 3 — Scene Position + Camera Marker

**Files:** `src/components/SpiralCamera.tsx` (edit — utility), Blender `CameraPath.glb`

- Add the S-7 entry to `SCENE_POSITIONS` (and any focal-point export) so `ArtGallery.tsx` knows where to place itself in world space. Keep objects **stationary in world space** — the camera travels through them (per [[feedback_scene_objects_static]]).
- Since the camera is now Blender-path-driven (`CameraPath.tsx` + `CameraPath.glb`), ensure the baked path actually reaches the S-7 region and `SCROLL_FRAME_MAP` allocates a dwell window around 0.84–0.94. If the path doesn't extend that far yet, extend the curve at the end only (existing frames stay identical, per BLENDER_GUIDE workflow).

### Step 4 — `/art` Full-Page Gallery

**File:** `src/app/art/page.tsx`

A standard DOM page (no Canvas), dark theme matching the design tokens.

- Responsive grid of artwork cards from `artworks.ts` (thumbnails).
- Click a card → lightbox overlay showing the full image + title/medium/year; ESC / backdrop click closes. Honor `?id=` query param to open directly.
- A "[← BACK]" link returning to `/` (`router.push('/')` or `<Link href="/">`).
- **Gotcha:** `globals.css` sets `overflow: hidden` on `body` for the SPA. The `/art` page needs vertical scrolling — give it a route-group layout (e.g. `src/app/art/layout.tsx`) that re-enables `overflow: auto`/`height: auto`, or a scroll container that overrides the global rule. Verify the home page scroll/Lenis behavior is unaffected.

### Step 5 — Wire-Up

**Files:** `src/app/page.tsx` (edit), `src/components/HUD.tsx` (edit)

- Mount `<ArtGallery />` inside the Canvas alongside the other scenes.
- Add "Art Gallery" / S-7 to the HUD scene ticker; optionally add a persistent "[ART]" CTA in the HUD linking to `/art`.
- **DevOverlay:** once S-7 ships, bump `<DevOverlay fromScrollT={...} />` to the next unfinished scene's `enterStart` (or remove it if S-7/S-8 are the last). Run `npm run build`.

### Phase 4 Verification Checklist

- [ ] Scrolling to ~84%, framed artworks arc into view with spotlights
- [ ] Hover scales a frame to 1.2 and shows its title/medium label; pupil dilates
- [ ] "[VIEW FULL GALLERY →]" and frame clicks navigate to `/art`
- [ ] `/art` renders a scrollable grid; lightbox opens/closes; `?id=` deep-links
- [ ] "[← BACK]" returns to `/` with the spiral scene intact (Lenis/scroll still works)
- [ ] `/art` scrolls vertically despite the global `overflow: hidden` on body
- [ ] Scene disposes after navigation / past 99% (React cleanup log fires)
- [ ] Mobile: frames and `/art` grid are readable and tappable
- [ ] `npm run build` succeeds

---

## Phase 5 — French Language Version (i18n)

**Goal:** A bilingual portfolio. A small `EN | FR` toggle in the HUD switches every visible string — HUD labels, annotations, scene text panels, art labels, CTAs, and the AI chat persona — between English and French. The site is a single-page client app, so this is a lightweight in-app i18n (a translation dictionary + a store-driven locale) rather than Next.js locale routing.

### Step 1 — Locale State

**File:** `src/store/useStore.ts` (edit)

- Add `locale: 'en' | 'fr'` and `setLocale(l)`.
- Initialize from `localStorage` if present, else from `navigator.language` (`fr*` → `'fr'`, else `'en'`); persist back to `localStorage` on change.

### Step 2 — Translation Dictionary

**File:** `src/lib/i18n.ts`

- Export a nested `translations` object keyed by locale: `{ en: {...}, fr: {...} }` with the same key shape.
- Cover every UI string: HUD (name tagline, CV/Chat/Art CTAs, scene ticker labels), S-0 annotations, each scene's text panel (GoPro headline/subtext/links, future scenes), ArtGallery header + "view full gallery", Conversion CTAs + tagline, DevOverlay text.
- Keep keys flat-ish and scene-scoped (e.g. `hud.cv`, `scene.gopro.headline`).

### Step 3 — Translation Hook

**File:** `src/hooks/useTranslation.ts`

- `'use client'` hook reading `locale` from the store and returning `t(key: string): string` (dot-path lookup into `translations[locale]`, falling back to `en` then the key itself).
- Also expose `locale` for components that need it directly (e.g. the chat call).

### Step 4 — Replace Hardcoded Strings

**Files (edit):** `HUD.tsx`, `Annotations.tsx`, `scenes/GoPro.tsx` (+ future scene panels), `scenes/ArtGallery.tsx`, `DevOverlay.tsx`, and any scene's `<Html>` text panel.

- Swap literal strings for `t('...')`. Artwork titles/mediums come from the localized fields added in Phase 4 Step 1 (`title[locale]`, `medium[locale]`).
- Keep the **no-emoji / ASCII-only** rule (CLAUDE.md) — note French accented characters (é, à, ç…) are allowed Latin text and required for correct copy; only emojis/symbols are banned.

### Step 5 — Localize the Chat Persona

**Files:** `src/lib/systemPrompt.ts` (edit), `src/app/api/chat/route.ts` (edit), `src/hooks/useChat.ts` (edit)

- Pass the current `locale` in the `/api/chat` request body.
- In the route, append a language instruction to the system prompt ("Respond in French." when `locale === 'fr'`), or maintain `systemPromptEn` / `systemPromptFr`. The CV facts can stay shared; only the voice/instruction switches.
- Localize ChatScreen UI strings (header, placeholder, prompt chips) via `t(...)` as well.

### Step 6 — Language Toggle + `<html lang>`

**Files:** `src/components/HUD.tsx` (edit), `src/app/layout.tsx` / `src/app/page.tsx` (edit)

- Add an `EN | FR` toggle in the HUD (Space Mono, design tokens) calling `setLocale`. Highlight the active locale.
- On locale change, set `document.documentElement.lang` so the `<html lang>` attribute is correct for SEO/accessibility. (Static `metadata` stays English; the app is client-rendered.)

### Phase 5 Verification Checklist

- [ ] `EN | FR` toggle visible in the HUD; active locale highlighted
- [ ] Switching to FR translates HUD, annotations, scene panels, art labels, CTAs
- [ ] Locale persists across reload (localStorage) and respects `navigator.language` on first visit
- [ ] Chat responds in French when FR is active; ChatScreen UI is translated
- [ ] French accented characters render correctly; no emojis introduced
- [ ] `document.documentElement.lang` updates with the toggle
- [ ] No layout breakage from longer French strings (FR text is often ~20% longer)
- [ ] `npm run build` succeeds

---

## File Summary

### New Files

| File | Phase | Type |
|---|---|---|
| `src/store/useStore.ts` | 1 | Zustand store |
| `src/hooks/useScroll.ts` | 1 | Scroll driver hook |
| `src/hooks/useAutoDrift.ts` | 1 | Idle drift hook |
| `src/components/SpiralCamera.tsx` | 1 | Camera controller (3D) |
| `src/components/Particles.tsx` | 1 | Particle cloud (3D) |
| `src/components/Annotations.tsx` | 1 | S-0 face labels (3D) |
| `src/components/HUD.tsx` | 1 | Persistent overlay (HTML) |
| `src/hooks/useSceneLifecycle.ts` | 2 | Reusable lifecycle hook |
| `src/components/scenes/GoPro.tsx` | 2 | S-1 GoPro scene (3D) |
| `src/app/api/chat/route.ts` | 3 | Mistral streaming API |
| `src/hooks/useChat.ts` | 3 | Chat state + streaming |
| `src/components/ChatScreen.tsx` | 3 | Chat HTML interface |
| `src/components/Tablet.tsx` | 3 | 3D tablet + embedded chat |
| `src/lib/artworks.ts` | 4 | Art asset manifest (localized titles) |
| `src/components/scenes/ArtGallery.tsx` | 4 | S-7 Art Gallery scene (3D) |
| `src/app/art/page.tsx` | 4 | Full-page art gallery (HTML) |
| `src/app/art/layout.tsx` | 4 | Route layout re-enabling page scroll |
| `src/lib/i18n.ts` | 5 | EN/FR translation dictionary |
| `src/hooks/useTranslation.ts` | 5 | Locale-aware `t()` hook |

### Edited Files

| File | Phase | Changes |
|---|---|---|
| `src/app/layout.tsx` | 1 | Add Space Mono, Bebas Neue, DM Sans fonts |
| `src/app/globals.css` | 1 | Add storyboard design tokens |
| `src/app/page.tsx` | 1, 2, 3, 4 | Camera prop rewrite, mount all scenes incl. `<ArtGallery />` (P4) |
| `src/components/SpiralCamera.tsx` | 2, 3, 4 | Scene focal points (P2), chat lerp (P3), S-7 position (P4) |
| `src/store/useStore.ts` | 3, 5 | Chat state (P3), `locale`/`setLocale` (P5) |
| `src/components/HUD.tsx` | 3, 4, 5 | Chat button/ESC (P3), S-7 ticker + Art CTA (P4), EN/FR toggle + `t()` (P5) |
| `src/components/Annotations.tsx` | 5 | Replace strings with `t()` |
| `src/components/scenes/GoPro.tsx` | 5 | Localize text panel via `t()` |
| `src/components/DevOverlay.tsx` | 4, 5 | Bump `fromScrollT` (P4), localize text (P5) |
| `src/lib/systemPrompt.ts` | 5 | Locale-aware persona / FR instruction |
| `src/app/api/chat/route.ts` | 5 | Accept `locale`, switch response language |
| `src/hooks/useChat.ts` | 5 | Send `locale` in request body |
| `src/app/layout.tsx` | 5 | Sync `<html lang>` on locale change |

### Unchanged Files

| File | Reason |
|---|---|
| `src/components/Head.tsx` | Already complete. No modifications needed in any phase. |
| `next.config.ts` | No config changes required. |
| `tsconfig.json` | Already configured correctly. |
| `package.json` | Only change: `npm install @mistralai/mistralai` in Phase 3. |
