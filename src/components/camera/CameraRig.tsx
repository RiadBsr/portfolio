'use client'

import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '@/store/useStore'
import { smootherstep } from '@/utils/easing'

// ─── FOV ramp ─────────────────────────────────────────────────────────────────
// Start telephoto (tight on head), widen as camera travels through space.
const FOV_START = 14
const FOV_END = 40
const FOV_RAMP_START = 0.04  // begin widening as camera starts pulling back
const FOV_RAMP_END = 0.20    // fully wide before transition curve

// ─── Path definition ──────────────────────────────────────────────────────────
// Single CatmullRom spline. Camera starts tight on head, pulls straight back,
// then curves 90° left. Camera always faces opposite tangent (backward travel).
//
// Top-down (X→ right, Z↓ into screen):
//
//   Head (0,0,0)
//     |
//     * (0,0,1.3)  path start — close-up
//     |
//     |  straight pullback along +Z
//     |
//     * (0,0,12)   approaching turn
//      \
//       \  smooth 90° left
//        \
//         *---------- (-12,0,18) along -X
//
//   GoPro (6,0,18) — right of turn, in camera's backward view after turn

const PATH_POINTS = [
  new THREE.Vector3(0,   0,    1.3),  // close-up on head
  new THREE.Vector3(0,   0,    3),    // pulling back
  new THREE.Vector3(0,   0,    8),    // straight pullback
  new THREE.Vector3(0,   0,   12),    // approach the turn
  new THREE.Vector3(-2,  0,   16),    // entering 90° left curve
  new THREE.Vector3(-6,  0,   18),    // apex
  new THREE.Vector3(-12, 0,   18),    // exiting turn — along -X
  new THREE.Vector3(-18, 0,   18),    // straight -X (future)
]

const _curve = new THREE.CatmullRomCurve3(PATH_POINTS, false, 'centripetal', 0.5)

// ─── Scene object positions ──────────────────────────────────────────────────
// Each scene defines a desktop and mobile position. On mobile, text overlays
// sit at the bottom, so objects often need to shift up or reposition entirely.
export interface CameraStop {
  objectPosition: THREE.Vector3
  mobilePosition: THREE.Vector3  // used when viewport width < 768
}

export const CAMERA_STOPS: CameraStop[] = [
  {
    objectPosition:  new THREE.Vector3(0, 0, 0),       // S-0 Head
    mobilePosition:  new THREE.Vector3(0, 0, 0),     // shifted up for bottom text
  },
  {
    objectPosition:  new THREE.Vector3(0, 0, 17.5),    // S-1 GoPro
    mobilePosition:  new THREE.Vector3(0, 0.6, 17.25),  // center-top on mobile
  },
]

// Desktop positions lookup
export const SCENE_OBJECT_POSITIONS: Record<number, THREE.Vector3> = {}
CAMERA_STOPS.forEach((stop, i) => { SCENE_OBJECT_POSITIONS[i] = stop.objectPosition })

// Mobile positions lookup
export const SCENE_MOBILE_POSITIONS: Record<number, THREE.Vector3> = {}
CAMERA_STOPS.forEach((stop, i) => { SCENE_MOBILE_POSITIONS[i] = stop.mobilePosition })

// For Particles.tsx
export const TRANSITION_CONTROLS: Record<string, THREE.Vector3> = {}

// ─── Scroll → path mapping ──────────────────────────────────────────────────
// scrollT 0→1 maps directly to the spline. Segments control speed per region.
interface PathSegment {
  scrollStart: number
  scrollEnd: number
  pathStart: number   // curve t (0–1)
  pathEnd: number
}

const PATH_SEGMENTS: PathSegment[] = [
  // S-0 dwell: slow crawl pulling back from head (close-up → breathing room)
  { scrollStart: 0.00, scrollEnd: 0.12, pathStart: 0.00, pathEnd: 0.08 },
  // Transition S-0→S-1: straight pullback + 90° left curve
  { scrollStart: 0.12, scrollEnd: 0.24, pathStart: 0.08, pathEnd: 0.58 },
  // S-1 dwell: slow crawl along -X, camera faces +X toward GoPro
  { scrollStart: 0.24, scrollEnd: 0.36, pathStart: 0.58, pathEnd: 0.66 },
  // Post S-1: continue along -X (future scenes)
  { scrollStart: 0.36, scrollEnd: 1.0,  pathStart: 0.66, pathEnd: 1.0 },
]

function scrollToPathT(scrollT: number): number {
  for (const seg of PATH_SEGMENTS) {
    if (scrollT <= seg.scrollEnd) {
      const segProg = Math.max(0, (scrollT - seg.scrollStart) / (seg.scrollEnd - seg.scrollStart))
      const eased = smootherstep(Math.min(1, segProg))
      return seg.pathStart + eased * (seg.pathEnd - seg.pathStart)
    }
  }
  // Clamp to [0, 1] — getPointAt crashes on out-of-range values
  return Math.min(1, Math.max(0, PATH_SEGMENTS[PATH_SEGMENTS.length - 1].pathEnd))
}

// ─── Chat mode ──────────────────────────────────────────────────────────────
const CHAT_CAMERA_POSITION = new THREE.Vector3(0.4, 0.1, 2.2)
const CHAT_LOOK_AT = new THREE.Vector3(0.12, 0, 0)
const CHAT_CAMERA_POSITION_MOBILE = new THREE.Vector3(0, 0.3, 2.0)
const CHAT_LOOK_AT_MOBILE = new THREE.Vector3(0, -0.25, 0)

// ─── Pre-allocated vectors ─────────────────────────────────────────────────
const _pos = new THREE.Vector3()
const _tangent = new THREE.Vector3()
const _lookAhead = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _mat = new THREE.Matrix4()
const _targetQuat = new THREE.Quaternion()

// ─── Component ──────────────────────────────────────────────────────────────
export function CameraRig() {
  const { camera } = useThree()
  const scrollT = useStore((s) => s.scrollT)
  const chatMode = useStore((s) => s.chatMode)

  const currentQuat = useRef(new THREE.Quaternion())
  const initialized = useRef(false)

  useFrame((state, delta) => {
    const t = Math.max(0, Math.min(1, scrollT))

    // ── FOV ramp ──
    const aspect = state.size.width / state.size.height
    let baseFov: number
    if (t <= FOV_RAMP_START) {
      baseFov = FOV_START
    } else if (t >= FOV_RAMP_END) {
      baseFov = FOV_END
    } else {
      const fovProg = smootherstep((t - FOV_RAMP_START) / (FOV_RAMP_END - FOV_RAMP_START))
      baseFov = FOV_START + fovProg * (FOV_END - FOV_START)
    }
    const targetFov = aspect < 1 ? baseFov + (1 - aspect) * 30 : baseFov
    const cam = camera as THREE.PerspectiveCamera
    if (Math.abs(cam.fov - targetFov) > 0.1) {
      cam.fov += (targetFov - cam.fov) * 0.08
      cam.updateProjectionMatrix()
    }

    let targetPos: THREE.Vector3
    let targetLookAt: THREE.Vector3 | null = null  // null = use tangent

    if (chatMode) {
      const isPortrait = aspect < 1
      targetPos = isPortrait ? CHAT_CAMERA_POSITION_MOBILE : CHAT_CAMERA_POSITION
      targetLookAt = isPortrait ? CHAT_LOOK_AT_MOBILE : CHAT_LOOK_AT
    } else {
      // Spline mode — position on curve, face opposite tangent (backward travel)
      const pathT = Math.min(0.999, Math.max(0, scrollToPathT(t)))
      _curve.getPointAt(pathT, _pos)
      _curve.getTangentAt(pathT, _tangent)
      targetPos = _pos
    }

    // Build target orientation — always through the same quaternion pipeline
    if (targetLookAt) {
      _mat.lookAt(targetPos, targetLookAt, _up)
    } else {
      // Backward travel: look opposite to tangent direction
      _lookAhead.copy(targetPos).sub(_tangent)
      _mat.lookAt(targetPos, _lookAhead, _up)
    }
    _targetQuat.setFromRotationMatrix(_mat)

    // Smooth position
    camera.position.lerp(targetPos, 1 - Math.exp(-6 * delta))

    // Smooth rotation via slerp — same path for all modes, no jumps
    if (!initialized.current) {
      currentQuat.current.copy(_targetQuat)
      initialized.current = true
    } else {
      currentQuat.current.slerp(_targetQuat, 1 - Math.exp(-3 * delta))
    }
    camera.quaternion.copy(currentQuat.current)
  })

  return null
}
