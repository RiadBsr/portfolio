'use client'

import * as THREE from 'three'
import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { damp3, dampQ } from 'maath/easing'
import { useStore } from '@/store/useStore'

// ─── Chat mode ────────────────────────────────────────────────────────────────
export const CHAT_CAMERA_POSITION = new THREE.Vector3(0.6, 0.15, 2.2)
export const CHAT_LOOK_AT = new THREE.Vector3(0.25, 0, 0)

// ─── Scroll → frame map ───────────────────────────────────────────────────────
// Each entry maps a scrollT range to an animation frame range.
// Creative control:
//   Large scrollT range → few frames  = camera crawls / pauses (scroll drives scene anims)
//   Small scrollT range → many frames = camera rushes
//   frameStart === frameEnd            = full camera stop
//
// FPS must match Blender export (scene FPS setting, currently 24).
const FPS = 24

// Temporary: linear mapping — replace with per-scene entries once
// the narrative path is built. See docs/STORYBOARD.md.
const SCROLL_FRAME_MAP = [
  { scrollStart: 0.0, scrollEnd: 1.0, frameStart: 0, frameEnd: 100 },
] as const

type FrameEntry = (typeof SCROLL_FRAME_MAP)[number]

function scrollTToTime(
  scrollT: number,
  map: readonly FrameEntry[],
  clipDuration: number,
): number {
  const t = Math.max(0, Math.min(1, scrollT))
  for (const entry of map) {
    if (t >= entry.scrollStart && t <= entry.scrollEnd) {
      const p = (t - entry.scrollStart) / (entry.scrollEnd - entry.scrollStart)
      const frame = entry.frameStart + p * (entry.frameEnd - entry.frameStart)
      return Math.min(frame / FPS, clipDuration)
    }
  }
  return clipDuration
}

// ─── Pre-allocated temporaries ────────────────────────────────────────────────
const _chatMatrix = new THREE.Matrix4()
const _chatTargetQ = new THREE.Quaternion()

// ─── Component ────────────────────────────────────────────────────────────────
export function CameraPath() {
  const { camera } = useThree()
  const scrollT = useStore((s) => s.scrollT)
  const chatMode = useStore((s) => s.chatMode)

  const { scene, animations } = useGLTF('/models/CameraPath.glb')

  // Refs for the mixer and animated rig — set up once on mount
  const rigRef = useRef<THREE.Object3D | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionRef = useRef<THREE.AnimationAction | null>(null)
  const clipRef = useRef<THREE.AnimationClip | null>(null)
  const smoothQuat = useRef(new THREE.Quaternion())

  useEffect(() => {
    const rig = scene.getObjectByName('CameraPath')
    if (!rig || !animations.length) return

    const clip = animations[0]
    const mixer = new THREE.AnimationMixer(scene)
    // Play once then immediately pause — we drive action.time manually.
    const action = mixer.clipAction(clip)
    action.play()
    action.paused = true

    rigRef.current = rig
    clipRef.current = clip
    mixerRef.current = mixer
    actionRef.current = action

    // Seed smooth quaternion from rig's time-0 rotation to prevent snap on first frame
    action.time = 0
    mixer.update(0)
    smoothQuat.current.copy(rig.quaternion)

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
    }
  }, [scene, animations])

  useFrame((state, delta) => {
    const cam = camera as THREE.PerspectiveCamera

    // ── Dynamic FOV ───────────────────────────────────────────────────────────
    const BASE_FOV = 14
    const aspect = state.size.width / state.size.height
    const targetFov = aspect < 1 ? BASE_FOV + (1 - aspect) * 30 : BASE_FOV
    if (Math.abs(cam.fov - targetFov) > 0.5) {
      cam.fov = targetFov
      cam.updateProjectionMatrix()
    }

    // ── Chat mode override ────────────────────────────────────────────────────
    if (chatMode) {
      damp3(camera.position, CHAT_CAMERA_POSITION, 0.08, delta)
      _chatMatrix.lookAt(camera.position, CHAT_LOOK_AT, THREE.Object3D.DEFAULT_UP)
      _chatTargetQ.setFromRotationMatrix(_chatMatrix)
      dampQ(smoothQuat.current, _chatTargetQ, 0.08, delta)
      camera.quaternion.copy(smoothQuat.current)
      return
    }

    const mixer = mixerRef.current
    const action = actionRef.current
    const clip = clipRef.current
    const rig = rigRef.current
    if (!mixer || !action || !clip || !rig) return

    // ── Sample the baked animation ────────────────────────────────────────────
    // Setting action.time directly on a paused action then calling mixer.update(0)
    // forces evaluation at exactly that point without advancing the mixer clock.
    action.time = scrollTToTime(scrollT, SCROLL_FRAME_MAP, clip.duration)
    mixer.update(0)

    // ── Apply rig transform to camera (damped for smooth feel) ────────────────
    damp3(camera.position, rig.position, 0.1, delta)
    dampQ(smoothQuat.current, rig.quaternion, 0.1, delta)
    camera.quaternion.copy(smoothQuat.current)
  })

  return null
}

useGLTF.preload('/models/CameraPath.glb')
