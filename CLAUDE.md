# CLAUDE.md

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build — run after any change to verify
npm run lint     # ESLint (next/core-web-vitals + typescript)
```

No test suite. Verify changes with `npm run build` (catches type errors, unused imports, SSR issues).

## Architecture

Single-page Next.js 16 portfolio (App Router) — full-viewport Three.js scene as the sole content. Camera orbits an interactive 3D head along an Archimedean spiral driven by scroll progress.

**Stack:** React 19, TypeScript strict, Three.js r183, @react-three/fiber 9, @react-three/drei 10, GSAP 3, Zustand 5, Tailwind CSS v4, maath, Lenis.

**Path alias:** `@/*` maps to `./src/*`

### File structure

```
src/
  app/
    layout.tsx            # Root layout — fonts (Geist, Space Mono, Bebas Neue, DM Sans)
    page.tsx              # Home — R3F Canvas, lighting, hooks, HUD overlay
    globals.css           # Dark theme, overflow:hidden, CSS design tokens, holoReveal keyframes
  components/
    Head.tsx              # Interactive 3D head — wireframe, cursor/gyro tracking, blink, pupil dilation
    SpiralCamera.tsx      # Camera path — Archimedean spiral, scene focal points, chat mode position
    Particles.tsx         # 200 ambient particles (Gaussian distribution)
    Annotations.tsx       # S-0 face annotations with hologram reveal, fade-out on scroll
    HUD.tsx               # Persistent HTML overlay — name, resume CTA, scene ticker, z-counter
    DevOverlay.tsx         # Reusable WIP overlay — blurs canvas + shows message after last finished scene
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
  models/gopro.glb        # GoPro model (Phase 2)
  textures/360.jpg        # 360 photo texture (Phase 2)
  resume.pdf
docs/
  PLAN.md                 # Detailed 3-phase implementation plan — source of truth for roadmap
  research.md             # Scene research notes — reference for Phase 2-3 content
```

## Key Patterns

- **All components are `'use client'`** — single-page SPA with no server components beyond layout.
- **State flows through Zustand** — `useStore.ts` is the single store. Components subscribe to individual selectors to avoid re-renders.
- **Pupil dilation is ref-counted** — call `pupilDilate()` on hover enter, `pupilContract()` on hover leave. Never set directly. Supports overlapping hovers.
- **`useFrame` for all per-frame logic** — cursor tracking, camera movement, morph targets. Uses `dampQ`/`damp3`/`damp` from `maath/easing` for smooth interpolation.
- **Scene boundaries** defined in `useStore.ts` (`SCENE_BOUNDARIES` array). Scene focal points and positions in `SpiralCamera.tsx` (`SCENE_FOCAL_POINTS`, `SCENE_POSITIONS`).
- **Scene lifecycle** managed via `useSceneLifecycle` hook — returns phase (`idle`/`entering`/`dwelling`/`exiting`/`disposed`), progress values, and visibility. Scene components split into outer guard (lifecycle check) and inner renderer (hooks + GLTF).
- **Scroll speed zones** in `useScroll.ts` — `getScrollSpeedMultiplier(t)` returns a per-scene speed factor. Scene dwell ranges use 0.2x multiplier so scroll mainly drives scene animations, not camera movement.
- **Mobile adaptations:** gyroscope replaces cursor input, eyelashes hidden below 768px, dynamic FOV on portrait screens, touch events get 2x multiplier.
- **DevOverlay (WIP gate):** `<DevOverlay fromScrollT={0.14} />` in `page.tsx` blurs the canvas and shows "WORK IN PROGRESS" when scrollT crosses the threshold. **When a new scene is finished**, update `fromScrollT` to the `enterStart` of the next unfinished scene. When all scenes are complete, remove the component entirely. The overlay sits at `zIndex: 5` (below HUD at 10, above canvas).

## Gotchas

- **Wireframe skinning hack:** `Head.tsx` duck-types `LineSegments` as `isSkinnedMesh` so Three.js uploads bone matrices. Do not refactor without understanding `createSharpEdgeGeometry`.
- **polygonOffset on all mesh materials** prevents Z-fighting between mesh surfaces and wireframe overlay. Must be preserved on any new materials.
- **Three.js r183 deprecation warnings** are suppressed in `page.tsx` (`console.warn` filter). Remove when R3F updates its internals.
- **Auto-drift vs scroll ownership:** `useAutoDrift` owns `scrollT` until `userHasInteracted` is true, then `useScroll` takes over. On handoff, `useScroll` syncs its accumulator from the store to prevent jumps.
- **GLTF clone + skeleton rebind** in `Head.tsx` is required because `useGLTF` caches the scene. Each mount clones and rebinds skeletons manually.
- **Scene-based culling:** As the camera progresses along the spiral, objects from 2+ scenes away are culled and disabled for optimization. `frustumCulled = false` is only used on the Head meshes (to prevent popping artifacts during the close-up orbit); other scene objects use standard frustum culling.

## Project Status

- **Phase 1 (COMPLETE):** Head scene, spiral camera, scroll/drift, HUD, annotations, particles.
- **Phase 2 (IN PROGRESS):** S-1 GoPro scene implemented with lifecycle, focal points, scroll slowdown. Remaining scenes: Sorbonne, BargMe, Hackathon, Samsung, Origin, Art Gallery, Conversion. See `docs/PLAN.md`.
- **Phase 3 (NOT STARTED):** Chat UI + Mistral LLM integration. See `docs/PLAN.md`.

## Conventions

- Use `'use client'` directive at top of every component/hook file.
- Prefer `useRef` over `useState` for values read in `useFrame` (avoids re-renders).
- Allocate Three.js objects (Vector3, Quaternion, Object3D) outside components or in `useMemo` — never inside `useFrame`.
- Font variables: `--font-space-mono` (HUD/labels), `--font-geist-sans` (body), `--font-bebas` (headings), `--font-dm-sans` (UI).
- Design tokens in `globals.css` (`:root` block): `--black`, `--white`, `--wire`, `--accent`, etc.
- **No emojis in the UI** — all visible text must use plain ASCII/Latin characters only. This applies to HUD labels, overlays, annotations, and any other rendered text.

## Deployment Rules

- **"Under development" notice is REQUIRED** after every major phase deployment. This is handled by the `<DevOverlay fromScrollT={...} />` component in `page.tsx`. It blurs the canvas and shows "WORK IN PROGRESS" / "MORE SCENES COMING SOON" once the user scrolls past the last finished scene. **When shipping a new scene**, update the `fromScrollT` prop to the `enterStart` value of the next unfinished scene. When all scenes are done, remove the component.
- Always run `npm run build` before deploying to catch errors.
- Each phase must be independently deployable — no broken UI or dead links to unfinished features (e.g. the CHAT button is greyed out until Phase 3 is live).
