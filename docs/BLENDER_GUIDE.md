# Blender → Three.js Camera Path Guide

This document explains how to model, export, and extend the camera path in Blender so that the portfolio's virtual camera follows it precisely.

---

## Export Format

**GLTF Binary (.glb)** — the same format used for `head.glb` and `gopro.glb`.

The exported GLB contains:
1. **One animated object** (Camera or Empty) with baked position + rotation keyframes on every frame
2. **Scene marker Empties** (optional) — named objects at positions where scenes are placed, so Three.js can read their transforms directly

No mesh geometry is needed in the camera path GLB — just the animation data and marker transforms.

**Output file:** `public/models/camera-path.glb`

---

## Blender Project Setup

### 1. Create the Camera Path Curve

1. Add → Curve → **Bezier Curve** (or Nurbs Path)
2. Enter Edit Mode, extrude control points to shape the path
3. The curve starts at the **head close-up position** (near world origin) and extends outward through each scene location
4. Name it `CameraPath`

**Important constraints:**
- The curve should start very close to `(0, 0, ~1.5)` — the initial extreme close-up position in front of the head (which sits at origin)
- The first segment should extend **straight back along +Z** (or -Z depending on your convention) — no spiral, no rotation. This creates the dramatic pullback reveal.
- After the pullback, the curve can turn, bank, rise, dip — whatever the narrative requires
- Keep the curve smooth (Bezier handles aligned) to avoid jerky camera movement

### 2. Create the Camera Follower

1. Add → **Empty** → Plain Axes (or Add → Camera)
2. Name it `CameraRig`
3. Add constraint: **Object Constraint Properties → Follow Path**
   - Target: `CameraPath`
   - Check **Follow Curve** (so the Empty's forward axis follows the tangent)
   - Check **Fixed Position** and use the **Offset** value to control position along the curve
4. Animate the **Offset** from `0.0` (start of curve) to `-1.0` (end of curve) over your total frame count
   - Frame 1: Offset = `0.0`
   - Frame N: Offset = `-1.0` (where N = total frames, e.g., 660)
   - Use **Linear interpolation** (not Bezier) in the Graph Editor for the Offset keyframes — this ensures even distribution of frames along the curve

### 3. Control Camera Rotation

The Follow Path constraint handles the camera's forward direction automatically. For additional rotation control:

**Option A: Let the curve dictate rotation (simplest)**
- The camera faces the tangent direction of the curve
- To make the camera "look backward" (retreating from the head), rotate the Empty 180° on its local Y-axis, or flip the Follow Path constraint's Forward axis

**Option B: Manual rotation overrides**
- Keyframe the Empty's rotation at specific frames to look at specific targets
- Use **Track To** constraint pointing at target Empties for precise look-at behavior
- Multiple constraints can be blended using their Influence sliders

**Option C: Separate look-at targets (most control)**
- Create additional Empties at points of interest (e.g., `LookAt_Head`, `LookAt_GoPro`)
- Add a **Track To** constraint on `CameraRig` targeting these
- Keyframe the constraint's **Influence** to blend between look-at targets:
  - Frame 0–48: Influence 1.0 on `LookAt_Head`
  - Frame 48–132: Blend to `LookAt_Title` (or hold forward)
  - Frame 132–168: Blend to `LookAt_GoPro`
  - etc.

### 4. Place Scene Markers

For each scene, add an **Empty** at the 3D position where that scene's objects should be placed:

1. Add → Empty → Plain Axes
2. Position it where the scene content should appear (visible from the camera at the right scroll point)
3. Rotate it to face the camera at its dwell position
4. Name it with a consistent convention:
   - `SceneMarker_Head`
   - `SceneMarker_GoPro`
   - `SceneMarker_Sorbonne`
   - etc.

These markers export as named nodes in the GLB. In Three.js, their world transforms are read and used directly as `<group position={...} rotation={...}>` for each scene component.

**Tip:** To visualize scene placement, temporarily add placeholder geometry (cubes, text) at marker positions in Blender. Delete them before export (or put them on a non-exported collection).

### 5. Bake the Animation

Before export, bake the constraint-driven animation into keyframes:

1. Select `CameraRig`
2. **Object → Animation → Bake Action**
   - Start Frame: 1
   - End Frame: your total (e.g., 660)
   - Check **Visual Keying** (captures constraint results)
   - Check **Clear Constraints** (removes constraints after bake — the keyframes now contain all the data)
   - Check **Overwrite Current Action**
3. Verify in the Dope Sheet: `CameraRig` should have Location + Rotation keyframes on every frame

### 6. Export as GLB

1. Select all objects to export: `CameraRig` + all `SceneMarker_*` Empties
2. **File → Export → glTF 2.0 (.glb)**
3. Export settings:
   - Format: **glTF Binary (.glb)**
   - Include: **Selected Objects** only
   - Transform: **+Y Up** (GLTF standard, Three.js expects this)
   - Animation: **Check all** (Animations, Shape Keys if any, Skinning off)
   - Animation → **Always Sample Animations**: ON
   - Animation → **Sampling Rate**: 1 (every frame)
4. Save as `public/models/camera-path.glb`

---

## Incremental Workflow (Extend Without Breaking)

This is the key workflow that allows building the path scene-by-scene:

### The Rule

> **Only add control points at the END of the curve. Never move existing control points.**

When this rule is followed:
- Existing frames (0 to N) produce identical camera positions and rotations after re-bake
- New frames (N+1 to N+M) extend the journey
- Code references to existing frame ranges remain valid

### Step-by-Step: Extending the Path

**Day 1 — Build scenes 0 and 1:**
1. Create curve from head to GoPro scene position (~168 frames of path)
2. Place `SceneMarker_Head` and `SceneMarker_GoPro`
3. Bake animation (frames 1–168)
4. Export `camera-path.glb`
5. In code, `SCROLL_FRAME_MAP` covers scrollT 0.00–0.42 → frames 0–228

**Day 2 — Add scene 2 (Sorbonne):**
1. Open same `.blend` file
2. Enter Edit Mode on `CameraPath`
3. Select the **last** control point
4. **Extrude** (E) to extend the curve toward the Sorbonne position
5. Add more control points as needed for the desired path shape
6. Place `SceneMarker_Sorbonne` at the scene position
7. Update `CameraRig`'s Follow Path:
   - Change the Offset end keyframe to the new total frame count
   - e.g., Frame 1: Offset 0.0, Frame 360: Offset -1.0
8. **Re-bake** animation (frames 1–360)
   - Frames 1–168 will be **identical** to before (same control points → same positions)
   - Frames 169–360 are new
9. Re-export `camera-path.glb`
10. In code, add new entries to `SCROLL_FRAME_MAP` for the Sorbonne range
11. Existing code for scenes 0–1 is **unchanged** — no regression

**Day 3+ — Repeat for each new scene:**
- Same process: extend curve, add markers, re-bake, re-export
- Always extend from the end, never modify earlier control points

### What If I Need to Adjust an Earlier Section?

If you must tweak an earlier part of the path (e.g., the camera angle at the GoPro scene isn't quite right):

1. Only adjust the **handles** (tangent directions) of existing control points, not the points themselves — this changes the curve shape locally without moving the control point positions
2. Re-bake the full animation
3. The affected frames will change slightly, but frames far from the edit will be unaffected
4. In code, you may need to adjust the frame numbers in `SCROLL_FRAME_MAP` for that section

This is a minor adjustment, not a breaking change. But avoid it if possible — get each section right before moving on.

---

## How Three.js Consumes the Path

### Loading the GLB

```typescript
// In CameraPath.tsx (replaces SpiralCamera.tsx)
const { scene, animations } = useGLTF('/models/camera-path.glb')

// Extract the animation clip (position + rotation tracks)
const clip = animations[0] // The baked CameraRig animation
const mixer = new THREE.AnimationMixer(scene)
const action = mixer.clipAction(clip)
action.play()
action.paused = true // We drive time manually via scrollT
```

### Sampling at a Scroll Position

```typescript
// The scroll-to-frame map (defined in code, matches Blender frame numbers)
const SCROLL_FRAME_MAP = [
  { scrollStart: 0.00, scrollEnd: 0.04, frameStart: 0,   frameEnd: 48  },
  { scrollStart: 0.04, scrollEnd: 0.07, frameStart: 48,  frameEnd: 60  }, // pause
  { scrollStart: 0.07, scrollEnd: 0.10, frameStart: 60,  frameEnd: 90  },
  // ... one entry per scroll segment
]

// In useFrame:
const frame = scrollTToFrame(scrollT, SCROLL_FRAME_MAP)
const time = frame / FPS // FPS = 30 (must match Blender's frame rate)
mixer.setTime(time)

// Read the animated object's transform
const cameraRig = scene.getObjectByName('CameraRig')
camera.position.copy(cameraRig.position)
camera.quaternion.copy(cameraRig.quaternion)
```

### Reading Scene Marker Positions

```typescript
// Scene components read their positions from the GLB
const goProMarker = scene.getObjectByName('SceneMarker_GoPro')
const goProPosition = goProMarker.position.clone()
const goProRotation = goProMarker.quaternion.clone()

// Used as: <group position={goProPosition} quaternion={goProRotation}>
```

### The scrollTToFrame Function

```typescript
function scrollTToFrame(scrollT: number, map: ScrollFrameEntry[]): number {
  for (const entry of map) {
    if (scrollT >= entry.scrollStart && scrollT < entry.scrollEnd) {
      const progress = (scrollT - entry.scrollStart) / (entry.scrollEnd - entry.scrollStart)
      return entry.frameStart + progress * (entry.frameEnd - entry.frameStart)
    }
  }
  // Past the end — clamp to last frame
  return map[map.length - 1].frameEnd
}
```

### Speed Control via the Map

The `SCROLL_FRAME_MAP` is how you control camera speed:

| Scenario | scrollT range | Frame range | Effect |
|---|---|---|---|
| **Camera pauses** | 0.04 – 0.07 (3% scroll) | 48 – 60 (12 frames) | Lots of scroll, few frames = camera barely moves |
| **Camera rushes** | 0.10 – 0.14 (4% scroll) | 90 – 132 (42 frames) | Little scroll, many frames = camera moves fast |
| **Camera near-stops** | 0.20 – 0.38 (18% scroll) | 168 – 192 (24 frames) | Huge scroll range, tiny frame range = scene dwell |

For a **complete camera stop**, set `frameStart === frameEnd` for that segment. The camera won't move at all, but scrollT still advances — driving scene animations, text reveals, etc.

---

## Controlling Scene Object Animations with scrollT

During camera pauses or slow sections, scrollT can drive scene-specific animations:

```typescript
// In GoPro.tsx, during dwell phase:
const dwellProgress = lifecycle.dwellProgress // 0→1 within the dwell scrollT range

// Map dwellProgress to animation stages
if (dwellProgress < 0.3) {
  // Hemispheres open
} else if (dwellProgress < 0.5) {
  // Hemispheres close
} else {
  // Stitch sweep
}
```

The camera pausing doesn't affect dwellProgress — it's computed from scrollT directly via `useSceneLifecycle`. So the user's scroll input drives the scene animation even when the camera is stationary.

---

## Scene Object Positioning Workflow

### Option A: Position in Blender, Export Transforms (Recommended)

1. In Blender, play through the camera animation to the frame where a scene should be visible
2. Place scene marker Empties at the desired 3D positions (visible from the camera at that frame)
3. Export markers in the GLB
4. In Three.js, read marker transforms and use as scene group positions
5. **Benefit:** WYSIWYG — what you see in Blender's viewport is what you get in the browser

### Option B: Position in Code Only

1. Sample the camera path at the scene's dwell frame
2. Offset the scene position to be in front of the camera
3. Compute the facing rotation so objects face the camera
4. **Benefit:** No Blender dependency for scene positioning
5. **Drawback:** Trial and error — can't preview in Blender

### Option C: Full Scene Layout in Blender (Advanced)

1. Model scene objects (or placeholders) in the same Blender file
2. Position them relative to the camera path
3. Export scene objects in separate GLBs with their world transforms
4. In Three.js, load each scene GLB and place at the exported position
5. **Benefit:** Complete WYSIWYG layout — Blender is the single source of truth
6. **Drawback:** Heavier export pipeline, more files to manage

**Recommendation:** Start with Option A (markers only). Graduate to Option C for complex scenes if needed.

---

## Blender File Organization

```
camera_path.blend
├── Collection: CameraSystem (exported)
│   ├── CameraPath          (Bezier Curve — the path)
│   ├── CameraRig           (Empty — animated follower, baked keyframes)
│   ├── SceneMarker_Head     (Empty — head position)
│   ├── SceneMarker_GoPro    (Empty — GoPro scene position)
│   ├── SceneMarker_Sorbonne (Empty — added later)
│   └── ...                  (more markers as scenes are built)
│
├── Collection: Visualization (NOT exported)
│   ├── PlaceholderCubes     (rough scene stand-ins for preview)
│   ├── CameraPreview        (Blender camera for viewport preview)
│   └── Lights               (for Blender viewport only)
│
└── Collection: SceneObjects (optional, separate exports)
    ├── GoPro model
    ├── Sorbonne objects
    └── ...
```

- **CameraSystem** collection is the only one selected for GLB export
- **Visualization** collection helps you preview the experience in Blender but is never exported
- **SceneObjects** collection (optional) can hold scene models that get exported as separate GLBs

---

## Frame Rate Convention

- **Blender scene FPS: 30**
- **Three.js sampling: `frame / 30`** to convert frame number to animation time in seconds
- Keep this consistent. If you change Blender's FPS, update the `FPS` constant in code.

---

## Checklist Before Export

- [ ] All control points in order (no loops, no self-intersections)
- [ ] CameraRig has Follow Path constraint with correct target
- [ ] Offset is animated from 0.0 to -1.0 across the full frame range
- [ ] Animation is baked (Visual Keying, Clear Constraints)
- [ ] All SceneMarker Empties are named and positioned
- [ ] Export settings: Selected Objects, +Y Up, Animations ON, Sample Rate 1
- [ ] File saved to `public/models/camera-path.glb`
- [ ] `SCROLL_FRAME_MAP` in code updated with new frame ranges (if path was extended)
