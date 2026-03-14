# CLAUDE.md

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build — run after any change to verify
npm run lint     # ESLint (next/core-web-vitals + typescript)
```

No test suite. Verify changes with `npm run build` (catches type errors, unused imports, SSR issues).

## Architecture

Single-page Next.js 16 portfolio (App Router) — full-viewport Three.js scene as the sole content. The camera follows a **Blender-authored 3D path** exported as GLB, driven by scroll progress. The path defines both position and rotation — giving full cinematic control over the camera journey through each scene.

**Stack:** React 19, TypeScript strict, Three.js r183, @react-three/fiber 9, @react-three/drei 10, GSAP 3, Zustand 5, Tailwind CSS v4, maath, Lenis.

**Path alias:** `@/*` maps to `./src/*`

### Camera Path System

The camera system has two layers:

1. **Blender curve** (`public/models/camera-path.glb`) — a baked animation clip containing position + rotation keyframes for every frame along the path. The path starts at an extreme close-up of the head and retreats through each scene. Modeled and exported from Blender. See `docs/BLENDER_GUIDE.md`.

2. **Scroll-to-frame map** (`SCROLL_FRAME_MAP` in `CameraPath.tsx`) — maps scrollT ranges to frame ranges. This decouples scroll speed from camera speed, allowing:
   - **Camera pauses** (many scrollT → few frames): scroll drives scene animations while camera holds position
   - **Camera rushes** (few scrollT → many frames): fast transitions between scenes
   - **Camera crawls** (lots of scrollT → few frames): slow dwell on scene content

The path is extended incrementally in Blender — existing control points never move, new ones are added at the end. Re-export overwrites the GLB but existing frame ranges stay identical. See `docs/BLENDER_GUIDE.md` for the full workflow.

### File structure

```
src/
  app/
    layout.tsx            # Root layout — fonts (Geist, Space Mono, Bebas Neue, DM Sans)
    page.tsx              # Home — R3F Canvas, lighting, hooks, HUD overlay
    globals.css           # Dark theme, overflow:hidden, CSS design tokens, holoReveal keyframes
  components/
    Head.tsx              # Interactive 3D head — wireframe, cursor/gyro tracking, blink, pupil dilation
    CameraPath.tsx        # Camera controller — loads GLB path, samples via SCROLL_FRAME_MAP
    Particles.tsx         # 200 ambient particles (Gaussian distribution)
    Annotations.tsx       # S-0 face annotations with hologram reveal, fade-out on scroll
    HUD.tsx               # Persistent HTML overlay — name, resume CTA, scene ticker, z-counter
    DevOverlay.tsx        # Reusable WIP overlay — blurs canvas + shows message after last finished scene
    scenes/
      GoPro.tsx           # S-1 GoPro scene — dual hemispheres, 360° textures, wireframe, lifecycle
  hooks/
    useScroll.ts          # Virtual scroll (wheel + touch), exponential smoothing, 6000px virtual distance
    useAutoDrift.ts       # Auto-drift on idle (3.5s delay, 0.5%/s), stops permanently on first interaction
    useSceneLifecycle.ts  # Reusable scene lifecycle hook — phase, progress, visibility from scrollT
  store/
    useStore.ts           # Zustand: scrollT, activeScene, chatMode, userHasInteracted, pupilDilateCount
public/
  models/head.glb         # Head GLTF (skeleton, BlinkAction animation)
  models/gopro.glb        # GoPro model
  models/camera-path.glb  # Blender-exported camera path (animated Empty + scene markers)
  textures/360.jpg        # 360 photo texture
  resume.pdf
docs/
  PLAN.md                 # Detailed implementation plan — source of truth for roadmap
  STORYBOARD.md           # Narrative storyboard — scroll budget, scene beats, text overlays
  BLENDER_GUIDE.md        # Blender workflow — how to model, export, and extend the camera path
  research.md             # Scene research notes — reference for content
```

## Camera Path System — How It Works

### Loading and Sampling

`CameraPath.tsx` loads `camera-path.glb` via `useGLTF`, extracts the animation clip, and creates an `AnimationMixer`. On each frame:

1. Read `scrollT` from Zustand store
2. Convert scrollT → frame number via `SCROLL_FRAME_MAP`
3. Convert frame → time: `time = frame / FPS` (FPS = 30, matching Blender)
4. Call `mixer.setTime(time)` to sample the animation
5. Copy the animated object's position + quaternion to the camera (with damping via `damp3`/`dampQ`)

### SCROLL_FRAME_MAP

An array of `{ scrollStart, scrollEnd, frameStart, frameEnd }` entries that maps scroll progress to animation frames. This is the primary creative control for pacing:

```typescript
const SCROLL_FRAME_MAP = [
  { scrollStart: 0.00, scrollEnd: 0.04, frameStart: 0,   frameEnd: 48  },  // Head pullback
  { scrollStart: 0.04, scrollEnd: 0.07, frameStart: 48,  frameEnd: 60  },  // Title card (pause)
  { scrollStart: 0.07, scrollEnd: 0.10, frameStart: 60,  frameEnd: 90  },  // Intro text
  // ... one entry per scroll segment, see STORYBOARD.md for full breakdown
]
```

When adding a new scene: append new entries to the map. Existing entries never change.

### Scene Marker Positions

Scene positions are read from named Empties exported in the camera-path GLB:
- `SceneMarker_Head`, `SceneMarker_GoPro`, `SceneMarker_Sorbonne`, etc.
- Their world-space transforms are used directly as `<group position={...} quaternion={...}>` in scene components
- Positions are authored in Blender (WYSIWYG with the camera path) — see `docs/BLENDER_GUIDE.md`

### Narrative & Storyboard

The camera path enables a story-driven experience, not just a project showcase. See `docs/STORYBOARD.md` for:
- Scene-by-scene narrative beats and text overlays
- Scroll budget allocation (which scenes get more scroll real estate)
- Camera behavior at each point (pause, rush, crawl)
- Text overlay timing and positioning

## Key Patterns

- **All components are `'use client'`** — single-page SPA with no server components beyond layout.
- **State flows through Zustand** — `useStore.ts` is the single store. Components subscribe to individual selectors to avoid re-renders.
- **Camera path is Blender-authored** — the GLB is the source of truth for camera position/rotation. Code never overrides the path; it only samples it. Speed control is in `SCROLL_FRAME_MAP`, not in the GLB.
- **Pupil dilation is ref-counted** — call `pupilDilate()` on hover enter, `pupilContract()` on hover leave. Never set directly. Supports overlapping hovers.
- **`useFrame` for all per-frame logic** — cursor tracking, camera sampling, morph targets. Uses `dampQ`/`damp3`/`damp` from `maath/easing` for smooth interpolation.
- **Scene boundaries** defined in `useStore.ts` (`SCENE_BOUNDARIES` array). Scene positions read from GLB markers in `CameraPath.tsx`.
- **Scene lifecycle** managed via `useSceneLifecycle` hook — returns phase (`idle`/`entering`/`dwelling`/`exiting`/`disposed`), progress values, and visibility. Scene components split into outer guard (lifecycle check) and inner renderer (hooks + GLTF).
- **Scroll drives both camera AND animations.** During camera pauses (SCROLL_FRAME_MAP entries where frameStart ≈ frameEnd), scrollT still advances — driving scene animations via `useSceneLifecycle` progress values. This allows text reveals, object transforms, and narrative beats while the camera holds position.
- **Mobile adaptations:** gyroscope replaces cursor input, eyelashes hidden below 768px, dynamic FOV on portrait screens, touch events get 2x multiplier.
- **DevOverlay (WIP gate):** `<DevOverlay fromScrollT={0.14} />` in `page.tsx` blurs the canvas and shows "WORK IN PROGRESS" when scrollT crosses the threshold. **When a new scene is finished**, update `fromScrollT` to the `enterStart` of the next unfinished scene. When all scenes are complete, remove the component entirely. The overlay sits at `zIndex: 5` (below HUD at 10, above canvas).
- **Incremental path workflow:** The Blender camera path is extended by adding control points at the end of the curve. Existing points never move → existing frames are identical after re-export → no code regression. See `docs/BLENDER_GUIDE.md`.

## Gotchas

- **Wireframe skinning hack:** `Head.tsx` duck-types `LineSegments` as `isSkinnedMesh` so Three.js uploads bone matrices. Do not refactor without understanding `createSharpEdgeGeometry`.
- **polygonOffset on all mesh materials** prevents Z-fighting between mesh surfaces and wireframe overlay. Must be preserved on any new materials.
- **Three.js r183 deprecation warnings** are suppressed in `page.tsx` (`console.warn` filter). Remove when R3F updates its internals.
- **Auto-drift vs scroll ownership:** `useAutoDrift` owns `scrollT` until `userHasInteracted` is true, then `useScroll` takes over. On handoff, `useScroll` syncs its accumulator from the store to prevent jumps.
- **GLTF clone + skeleton rebind** in `Head.tsx` is required because `useGLTF` caches the scene. Each mount clones and rebinds skeletons manually.
- **Scene-based culling:** As the camera progresses along the path, objects from 2+ scenes away are culled and disabled for optimization. `frustumCulled = false` is only used on the Head meshes (to prevent popping artifacts during the close-up); other scene objects use standard frustum culling.
- **GLB FPS must match code FPS.** The Blender scene must be 30fps. The `FPS` constant in `CameraPath.tsx` must be 30. If these diverge, camera sampling will be off.
- **AnimationMixer.setTime()** — the mixer must have `action.play()` called once and then `action.paused = true`. We drive time manually; the mixer must not auto-advance.

## Project Status

- **Phase 1 (COMPLETE):** Head scene, camera path system, scroll/drift, HUD, annotations, particles. Camera currently uses a procedural spiral (to be replaced by Blender GLB path — `SpiralCamera.tsx` → `CameraPath.tsx`).
- **Phase 2 (IN PROGRESS):** S-1 GoPro scene implemented with lifecycle, focal points, scroll slowdown. Camera path migration pending (waiting for Blender export). Remaining scenes: Sorbonne, BargMe, Hackathon, Samsung, Origin, Art Gallery, Conversion. See `docs/PLAN.md` and `docs/STORYBOARD.md`.
- **Phase 3 (NOT STARTED):** Chat UI + Mistral LLM integration. See `docs/PLAN.md`.

## Conventions

- Use `'use client'` directive at top of every component/hook file.
- Prefer `useRef` over `useState` for values read in `useFrame` (avoids re-renders).
- Allocate Three.js objects (Vector3, Quaternion, Object3D) outside components or in `useMemo` — never inside `useFrame`.
- Font variables: `--font-space-mono` (HUD/labels), `--font-geist-sans` (body), `--font-bebas` (headings), `--font-dm-sans` (UI).
- Design tokens in `globals.css` (`:root` block): `--black`, `--white`, `--wire`, `--accent`, etc.
- Camera path changes go through Blender → export → code update cycle. Never hardcode camera positions in components.
- Scene positions come from GLB markers. Don't compute positions procedurally — place them in Blender.

## Deployment Rules

- **"Under development" notice is REQUIRED** after every major phase deployment. This is handled by the `<DevOverlay fromScrollT={...} />` component in `page.tsx`. It blurs the canvas and shows "WORK IN PROGRESS" / "MORE SCENES COMING SOON" once the user scrolls past the last finished scene. **When shipping a new scene**, update the `fromScrollT` prop to the `enterStart` value of the next unfinished scene. When all scenes are done, remove the component.
- Always run `npm run build` before deploying to catch errors.
- Each phase must be independently deployable — no broken UI or dead links to unfinished features (e.g. the CHAT button is greyed out until Phase 3 is live).

## Documentation Map

| Document | Purpose |
|---|---|
| `CLAUDE.md` (this file) | Architecture, patterns, conventions — the technical reference |
| `docs/STORYBOARD.md` | Narrative storyboard — what the user experiences at each scroll point |
| `docs/BLENDER_GUIDE.md` | How to model, export, extend the camera path in Blender |
| `docs/PLAN.md` | Implementation phases, step-by-step build order |
| `docs/research.md` | Scene content research notes |
