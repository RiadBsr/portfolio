# Implementation Plan

Three phases. Each phase ends with a deployable state. The camera follows a Blender-authored 3D path (GLB export), not a procedural spiral. See `docs/BLENDER_GUIDE.md` for the Blender workflow and `docs/STORYBOARD.md` for the narrative breakdown.

---

## Phase 1 — Head Scene + Camera Path + HUD ✅ (COMPLETE, pending path migration)

**Goal:** The visitor lands on an extreme close-up of the head. The camera pulls straight back along a Blender-authored path, revealing the face, a title card, and eventually the void. Scrolling drives the camera. Annotations appear on the face at the start and fade out. A persistent HUD shows the name, CTAs, scene ticker, and z-coordinate.

**Current state:** Phase 1 is fully functional using a **procedural Archimedean spiral** (`SpiralCamera.tsx`). This will be replaced by the Blender GLB path (`CameraPath.tsx`) when the first path export is ready. The migration is non-breaking — the same `scrollT` store value drives both systems.

### Camera Path Migration Steps

When the Blender camera path GLB is ready (`public/models/camera-path.glb`):

#### Step 1 — CameraPath Component

**File:** `src/components/CameraPath.tsx` (new, replaces `SpiralCamera.tsx`)

Responsibilities:
1. Load `camera-path.glb` via `useGLTF`. Extract the animation clip and create an `AnimationMixer`.
2. Play the clip action once and immediately pause it (`action.paused = true`). Time is driven manually.
3. Define `SCROLL_FRAME_MAP`: array of `{ scrollStart, scrollEnd, frameStart, frameEnd }`. See `docs/STORYBOARD.md` for values.
4. Define `FPS = 30` constant (must match Blender scene FPS).
5. In `useFrame`: read `scrollT` → convert to frame via `scrollTToFrame()` → convert to time (`frame / FPS`) → call `mixer.setTime(time)` → copy animated object's position/quaternion to camera (with damping).
6. Export scene marker positions by reading named Empties from the GLB (`SceneMarker_GoPro`, etc.).
7. Preserve chat mode override: when `chatMode` is true, lerp camera to fixed chat position instead of following path.

#### Step 2 — Update Scene Position References

- Scene components currently import `SCENE_POSITIONS` from `SpiralCamera.tsx`
- Update imports to use marker positions from `CameraPath.tsx`
- `GoPro.tsx` and future scenes read their position from the GLB markers

#### Step 3 — Remove SpiralCamera

- Delete `SpiralCamera.tsx` (or keep as fallback behind a feature flag)
- Update `page.tsx` to render `<CameraPath />` instead of `<SpiralCamera />`
- Remove `buildSpiralCurve`, `SCENE_POSITIONS`, `SCENE_FOCAL_POINTS` exports

#### Step 4 — Simplify useScroll

- Remove `getScrollSpeedMultiplier()` from `useScroll.ts` — speed control is now in `SCROLL_FRAME_MAP`
- `useScroll` becomes a pure input driver: captures wheel/touch → updates scrollT
- The scroll multiplier logic moves to the frame map (scene dwell = large scrollT range mapped to few frames)

### Existing Phase 1 Components (unchanged)

These components work with any camera system — they read `scrollT` from the store, not camera position:

- **`useStore.ts`** — Zustand store with `scrollT`, `activeScene`, etc.
- **`useScroll.ts`** — Scroll driver (simplified after migration)
- **`useAutoDrift.ts`** — Idle drift hook
- **`Particles.tsx`** — 200-point Gaussian cloud
- **`Annotations.tsx`** — S-0 face labels (hologram reveal, fade on scroll)
- **`HUD.tsx`** — Persistent overlay (name, CTAs, scene ticker, z-counter)
- **`Head.tsx`** — Interactive 3D head (wireframe, tracking, blink)
- **`DevOverlay.tsx`** — WIP blur gate

### Phase 1 Verification Checklist

- [x] Page loads with camera extremely close to head (one eye + cheek visible)
- [x] After 3.5s of idle, camera starts drifting backward
- [x] Scrolling takes manual control; auto-drift never returns
- [x] Annotations fade in on load with stagger, fade out by scrollT > 0.08
- [x] Particles visible as dim white specks
- [x] HUD shows name (top-left), z-counter (bottom-left), scene ticker (right)
- [ ] **Camera follows Blender GLB path** (pending migration)
- [ ] **Camera pulls straight back from face** (not spiral — pending GLB)
- [ ] **Title card "RIAD BOUSSOURA"** appears during camera pause at scrollT 0.04–0.07
- [ ] **Scene markers from GLB** provide scene positions (pending GLB)

---

## Phase 2 — Content Scenes with Narrative Path

**Goal:** Each scene is a chapter in a narrative journey. The camera path (authored in Blender) guides the visitor through project scenes with deliberate pacing — pauses for titles, slow dwells for content, fast transitions between chapters. Text overlays provide narrative context. See `docs/STORYBOARD.md` for the full breakdown.

### Step 0 — Camera Path in Blender

**Before any scene code:** Model the camera path for scenes 0–1 in Blender and export the first `camera-path.glb`. This establishes the coordinate system and camera behavior that all scenes are positioned relative to.

Follow `docs/BLENDER_GUIDE.md`:
1. Create Bezier curve starting at head close-up, pulling straight back
2. Extend curve to GoPro scene position
3. Place scene marker Empties
4. Bake animation, export GLB
5. Implement `CameraPath.tsx` (see Phase 1 migration steps)

### Step 1 — Scene Lifecycle Hook ✅ (COMPLETE)

**File:** `src/hooks/useSceneLifecycle.ts`

Already implemented. Returns `phase`, `enterProgress`, `dwellProgress`, `exitProgress`, `visible`, `shouldMount` based on scrollT thresholds. Every scene calls this hook.

### Step 2 — Text Overlay System

**File:** `src/components/TextOverlay.tsx` (new)

A reusable component for narrative text that appears at specific scroll positions:

```typescript
<TextOverlay
  scrollStart={0.04}    // fade in at this scrollT
  scrollEnd={0.07}      // fade out at this scrollT
  position="right"      // screen position or 3D world position
  style="title"         // title | body | label (maps to font/size)
>
  RIAD BOUSSOURA
</TextOverlay>
```

Implementation:
- Reads `scrollT` from store
- Computes opacity: 0 before scrollStart, fade in over 0.005, hold, fade out before scrollEnd
- Renders as HTML overlay (`position: fixed`) or drei `<Html>` in 3D space
- Three style presets: title (Bebas Neue, large), body (DM Sans, medium), label (Space Mono, small)

### Step 3 — S-1 GoPro Scene ✅ (COMPLETE)

**File:** `src/components/scenes/GoPro.tsx`

Already implemented with full lifecycle: dual hemispheres, stitching animation, wireframe, text panel. Needs position update to use GLB marker instead of computed `SCENE_POSITIONS[1]`.

### Step 4 — Title Card System

Add the first narrative text overlays (see `docs/STORYBOARD.md` ACT 0):
- "RIAD BOUSSOURA" — large title during camera pause (scrollT 0.04–0.07)
- Subtitle: "R&D Engineer — Computer Vision & AI"
- Tagline during intro drift (scrollT 0.07–0.10)

These use the `TextOverlay` component from Step 2.

### Step 5 — Extend Path for S-2 (Sorbonne)

In Blender:
1. Open `camera_path.blend`
2. Extend the curve past the GoPro position toward Sorbonne location
3. Add `SceneMarker_Sorbonne`
4. Re-bake, re-export `camera-path.glb`
5. Add new entries to `SCROLL_FRAME_MAP` in code
6. Existing S-0 and S-1 entries unchanged — no regression

**File:** `src/components/scenes/Sorbonne.tsx` (new)

Lifecycle: enterStart 0.46, enterEnd 0.50, exitStart 0.56, disposeAt 0.62

Objects: Paper planes that unfold, neural architecture diagram, scholarship medallion.

### Step 6–10 — Remaining Scenes

Each scene follows the same pattern:
1. Extend Blender curve, add marker, re-export GLB
2. Add `SCROLL_FRAME_MAP` entries for the new section
3. Create scene component with `useSceneLifecycle`
4. Add narrative text overlays for chapter titles
5. Update `DevOverlay fromScrollT` to gate unfinished content

| Step | Scene | File | scrollT Range |
|---|---|---|---|
| 6 | S-3 BargMe | `scenes/BargMe.tsx` | 0.62 – 0.66 |
| 7 | S-4 Hackathon | `scenes/Hackathon.tsx` | 0.66 – 0.70 |
| 8 | S-5 Samsung | `scenes/Samsung.tsx` | 0.70 – 0.78 |
| 9 | S-6 Origin | `scenes/Origin.tsx` | 0.78 – 0.86 |
| 10 | S-7 Art Gallery | `scenes/ArtGallery.tsx` | 0.86 – 0.93 |
| 11 | S-8 Conversion | `scenes/Conversion.tsx` | 0.93 – 1.00 |

### Phase 2 Implementation Order

```
0. Camera path in Blender → first camera-path.glb export
1. CameraPath.tsx                — replaces SpiralCamera.tsx
2. TextOverlay.tsx               — reusable narrative text component
3. Title card + intro text       — first narrative overlays
4. GoPro position update         — use GLB marker instead of computed position
5–11. Remaining scenes           — one at a time, each extending the Blender path
```

### Phase 2 Verification Checklist

- [ ] Camera follows Blender GLB path with correct position + rotation
- [ ] Camera pauses during title card (scrollT 0.04–0.07)
- [ ] "RIAD BOUSSOURA" title appears during pause
- [ ] Camera speed varies per SCROLL_FRAME_MAP (rush, dwell, pause)
- [ ] Scene positions match GLB markers (WYSIWYG with Blender)
- [ ] Extending the path in Blender doesn't break existing scenes
- [ ] Each scene has narrative text (chapter title or context)
- [ ] DevOverlay gates unfinished content
- [ ] `npm run build` succeeds after each scene addition
- [ ] Mobile: all scenes render, text readable, touch scroll works

---

## Phase 3 — 3D Tablet Chat

**Goal:** Clicking [Chat] anywhere summons a floating tablet in 3D space. The tablet's screen shows a real chat interface powered by a Mistral API backend. This is the conversion centerpiece.

### Step 0 — Install Mistral SDK

```
npm install @mistralai/mistralai
```

Add `MISTRAL_API_KEY` to `.env.local` (gitignored).

### Step 1 — Chat API Route

**File:** `src/app/api/chat/route.ts`

Next.js Route Handler (POST). Accepts `{ messages }`, calls Mistral with streaming, returns SSE response. System prompt contains Riad's CV, project details, availability, tone.

### Step 2 — Chat Hook

**File:** `src/hooks/useChat.ts`

Manages `messages`, `isStreaming`, `error`. Handles fetch + streaming response parsing.

### Step 3 — Tablet Component

**File:** `src/components/Tablet.tsx`

3D tablet with embedded chat UI via drei `<Html>`. Spring entrance animation, floating prompt chips, ESC to dismiss.

### Step 4 — Chat Screen

**File:** `src/components/ChatScreen.tsx`

Standard React chat UI: message history, input bar, prompt chips, streaming indicators.

### Step 5 — Camera Chat Position

**File:** `src/components/CameraPath.tsx` (edit)

Add chat mode: when `chatMode` is true, GSAP tweens camera from current path position to fixed chat position. When dismissed, returns to path.

### Step 6 — Store + HUD Updates

Enable [Chat] button in HUD, add ESC handler, mobile chat button.

### Phase 3 Implementation Order

```
0. npm install @mistralai/mistralai + .env.local
1. src/app/api/chat/route.ts
2. src/hooks/useChat.ts
3. src/components/ChatScreen.tsx
4. src/components/Tablet.tsx
5. src/components/CameraPath.tsx — chat mode camera
6. src/components/HUD.tsx — enable chat button
7. src/app/page.tsx — mount Tablet
```

### Phase 3 Verification Checklist

- [ ] `POST /api/chat` returns streaming response
- [ ] Clicking [Chat]: camera smoothly lerps to chat position
- [ ] Tablet materializes with spring animation
- [ ] Prompt chips float and bob, send message on click
- [ ] Streaming tokens appear in real-time
- [ ] ESC: tablet shrinks, camera returns to scroll position
- [ ] Scroll disabled during chat mode
- [ ] Mobile: tablet fills screen, inline prompt chips
- [ ] API errors show user-friendly message
- [ ] `npm run build` succeeds
- [ ] `.env.local` is in `.gitignore`

---

## File Summary

### New Files (Camera Path Migration)

| File | Phase | Type |
|---|---|---|
| `src/components/CameraPath.tsx` | 1→2 | Camera controller (replaces SpiralCamera.tsx) |
| `src/components/TextOverlay.tsx` | 2 | Narrative text overlays |
| `public/models/camera-path.glb` | 2 | Blender-exported camera path + scene markers |

### New Files (Scenes)

| File | Phase | Type |
|---|---|---|
| `src/components/scenes/Sorbonne.tsx` | 2 | S-2 scene |
| `src/components/scenes/BargMe.tsx` | 2 | S-3 scene |
| `src/components/scenes/Hackathon.tsx` | 2 | S-4 scene |
| `src/components/scenes/Samsung.tsx` | 2 | S-5 scene |
| `src/components/scenes/Origin.tsx` | 2 | S-6 scene |
| `src/components/scenes/ArtGallery.tsx` | 2 | S-7 scene |
| `src/components/scenes/Conversion.tsx` | 2 | S-8 scene |

### New Files (Chat)

| File | Phase | Type |
|---|---|---|
| `src/app/api/chat/route.ts` | 3 | Mistral streaming API |
| `src/hooks/useChat.ts` | 3 | Chat state + streaming |
| `src/components/ChatScreen.tsx` | 3 | Chat HTML interface |
| `src/components/Tablet.tsx` | 3 | 3D tablet + embedded chat |

### Files to Remove (after path migration)

| File | Reason |
|---|---|
| `src/components/SpiralCamera.tsx` | Replaced by `CameraPath.tsx` |

### Edited Files

| File | Phase | Changes |
|---|---|---|
| `src/hooks/useScroll.ts` | 2 | Remove `getScrollSpeedMultiplier()` (speed control moves to SCROLL_FRAME_MAP) |
| `src/app/page.tsx` | 2, 3 | Replace `<SpiralCamera>` with `<CameraPath>`, mount scenes, mount Tablet |
| `src/components/scenes/GoPro.tsx` | 2 | Update position to use GLB marker |
| `src/store/useStore.ts` | 3 | Chat-related state if needed |
| `src/components/HUD.tsx` | 3 | Enable chat button, ESC handler |

### Unchanged Files

| File | Reason |
|---|---|
| `src/components/Head.tsx` | Already complete. No modifications needed. |
| `src/components/Annotations.tsx` | Works with scrollT directly, camera-agnostic. |
| `src/components/Particles.tsx` | Static, camera-agnostic. |
| `src/hooks/useAutoDrift.ts` | Drives scrollT, camera-agnostic. |
| `src/hooks/useSceneLifecycle.ts` | Works with scrollT directly, camera-agnostic. |
