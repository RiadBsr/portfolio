'use client'

import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { damp3 } from 'maath/easing'
import { useStore } from '@/store/useStore'

// ─── Spiral parameters ────────────────────────────────────────────────────────
// Archimedean spiral: 2.5 full revolutions, radius 0.5 → 45 Three.js units.
// Start radius ~1.3 puts the camera near the head surface for the extreme
// close-up at S-0 (head fills ~80% of viewport with fov=14).
// Angle offset π/2 ensures the spiral starts directly in front of the head
// (+Z axis) rather than on its side.
// Gentle Y undulation (±2 units) gives a helix feel — like unwinding a DNA strand.
const SPIRAL_POINTS = 80
const SPIRAL_REVOLUTIONS = 2.5
const SPIRAL_RADIUS_START = 3.0  // matches INTRO_Z_END — seamless spiral handoff
const SPIRAL_RADIUS_END = 45
const SPIRAL_ANGLE_OFFSET = Math.PI / 2 // start in front of head (+Z direction)

// ─── Scene positions ──────────────────────────────────────────────────────────
// World-space positions where scene objects are placed along the spiral.
// Computed by sampling the spiral curve at each scene's dwell midpoint,
// then offsetting inward toward the origin so the camera orbits past them.
const _spiralCurve = buildSpiralCurve()
function computeScenePosition(spiralT: number, inwardOffset: number): THREE.Vector3 {
  const pt = _spiralCurve.getPoint(spiralT)
  const toOrigin = pt.clone().normalize().negate()
  return pt.clone().addScaledVector(toOrigin, inwardOffset)
}

export const SCENE_POSITIONS: Record<number, THREE.Vector3> = {
  1: computeScenePosition(0.30, 5), // S-1 GoPro — dwell midpoint t=0.30, 5 units inward
}

// ─── Scene focal points ───────────────────────────────────────────────────────
// The world-space position the camera looks toward when each scene is active.
export const SCENE_FOCAL_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0),   // S-0 — head (permanent)
  SCENE_POSITIONS[1],            // S-1 — GoPro
  new THREE.Vector3(0, 0, 0),   // S-2 — Sorbonne     (Phase 2)
  new THREE.Vector3(0, 0, 0),   // S-3 — BargMe       (Phase 2)
  new THREE.Vector3(0, 0, 0),   // S-4 — Hackathon    (Phase 2)
  new THREE.Vector3(0, 0, 0),   // S-5 — Samsung      (Phase 2)
  new THREE.Vector3(0, 0, 0),   // S-6 — Origin       (Phase 2)
  new THREE.Vector3(0, 0, 0),   // S-7 — Art Gallery  (Phase 2)
  new THREE.Vector3(0, 0, 0),   // S-8 — Conversion   (Phase 2)
]

// ─── Chat mode positions ─────────────────────────────────────────────────────
// Landscape: camera slightly right so the head sits in the left ~70% of the
// viewport, leaving room for the chat panel on the right.
export const CHAT_CAMERA_POSITION = new THREE.Vector3(0.4, 0.1, 2.2)
export const CHAT_LOOK_AT = new THREE.Vector3(0.12, 0, 0)

// Portrait (mobile): chat panel covers the bottom half of the screen, so the
// camera goes below the head looking up — the crown/forehead peeks into the
// top of the viewport above the panel ("sneak peek from the top" effect).
export const CHAT_CAMERA_POSITION_MOBILE = new THREE.Vector3(0, 0.3, 2.0)
export const CHAT_LOOK_AT_MOBILE = new THREE.Vector3(0, -0.25, 0)

// ─── Spiral curve factory ─────────────────────────────────────────────────────
// Exported so Phase 2 scene components can sample world-space positions along
// the spiral without duplicating the generation logic.
export function buildSpiralCurve(): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = []
  for (let i = 0; i < SPIRAL_POINTS; i++) {
    const frac = i / (SPIRAL_POINTS - 1)
    const angle = frac * SPIRAL_REVOLUTIONS * Math.PI * 2 + SPIRAL_ANGLE_OFFSET
    const radius = SPIRAL_RADIUS_START + (SPIRAL_RADIUS_END - SPIRAL_RADIUS_START) * frac
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const y = Math.sin(angle * 0.3) * 2 * frac  // ±2 units, scaled by frac so y=0 at start
    points.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
}

// ─── Intro phase ──────────────────────────────────────────────────────────────
// scrollT 0 → INTRO_T: camera pulls straight back along Z from close-up to the
// spiral start. scrollT INTRO_T → 1 is remapped to spiralT 0 → 1.
export const INTRO_T = 0.10
const INTRO_Z_START = 1.3  // original spiral start — head fills the frame
const INTRO_Z_END = 3.0    // matches new SPIRAL_RADIUS_START — seamless spiral handoff

// Pre-allocated vector for intro target (never allocate inside useFrame)
const _introTarget = new THREE.Vector3(0, 0, INTRO_Z_START)

// ─── Component ────────────────────────────────────────────────────────────────
export function SpiralCamera() {
  const { camera } = useThree()
  const scrollT = useStore((s) => s.scrollT)
  const activeScene = useStore((s) => s.activeScene)
  const chatMode = useStore((s) => s.chatMode)

  // Build the spline once; stable across re-renders
  const curve = useMemo(() => buildSpiralCurve(), [])

  // Smoothly interpolated look-at target — updated each frame toward the
  // active scene's focal point. Stored as a ref to avoid triggering re-renders.
  const lookAt = useRef(new THREE.Vector3(0, 0, 0))

  useFrame((state, delta) => {
    const t = Math.max(0, Math.min(1, scrollT))

    // Dynamic FOV: widen on portrait screens so the head has breathing room
    const BASE_FOV = 14
    const aspect = state.size.width / state.size.height
    const targetFov = aspect < 1 ? BASE_FOV + (1 - aspect) * 30 : BASE_FOV
    const cam = camera as THREE.PerspectiveCamera
    if (Math.abs(cam.fov - targetFov) > 0.5) {
      cam.fov = targetFov
      cam.updateProjectionMatrix()
    }

    if (chatMode) {
      // Chat mode: portrait screens get an upward-looking position so the head
      // peeks in from the top above the bottom chat panel; landscape keeps the
      // head in the left portion beside the panel.
      const isPortrait = aspect < 1
      const chatPos = isPortrait ? CHAT_CAMERA_POSITION_MOBILE : CHAT_CAMERA_POSITION
      const chatLook = isPortrait ? CHAT_LOOK_AT_MOBILE : CHAT_LOOK_AT
      damp3(camera.position, chatPos, 0.08, delta)
      damp3(lookAt.current, chatLook, 0.08, delta)
    } else if (t < INTRO_T) {
      // Intro: straight Z pullback from tight close-up to spiral start
      const prog = t / INTRO_T
      _introTarget.set(0, 0, INTRO_Z_START + prog * (INTRO_Z_END - INTRO_Z_START))
      damp3(camera.position, _introTarget, 0.1, delta)
      damp3(lookAt.current, SCENE_FOCAL_POINTS[0], 0.08, delta)
    } else {
      // Normal: remap scrollT → spiralT and follow the Catmull-Rom spiral
      const spiralT = (t - INTRO_T) / (1 - INTRO_T)
      const spiralPos = curve.getPoint(spiralT)
      damp3(camera.position, spiralPos, 0.1, delta)

      // Smoothly shift look-at toward the active scene's focal point
      const focalPoint = SCENE_FOCAL_POINTS[activeScene] ?? SCENE_FOCAL_POINTS[0]
      damp3(lookAt.current, focalPoint, 0.08, delta)
    }

    camera.lookAt(lookAt.current)
  })

  // Purely imperative — renders nothing
  return null
}
