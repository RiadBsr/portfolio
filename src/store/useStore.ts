'use client'

import { create } from 'zustand'

// Scene activation boundaries — the scrollT value at which each scene
// becomes the "active" scene (drives camera look-at focal point).
// Aligned with storyboard enter-start percentages.
const SCENE_BOUNDARIES = [0, 0.14, 0.42, 0.50, 0.58, 0.66, 0.74, 0.84, 0.94] as const

function computeActiveScene(t: number): number {
  for (let i = SCENE_BOUNDARIES.length - 1; i >= 0; i--) {
    if (t >= SCENE_BOUNDARIES[i]) return i
  }
  return 0
}

interface StoreState {
  // 0 → 1, normalized scroll progress along the spiral
  scrollT: number
  // derived from scrollT via SCENE_BOUNDARIES
  activeScene: number
  // true while the 3D tablet chat is open
  chatMode: boolean
  // flips to true on first scroll/touch; disables auto-drift permanently
  userHasInteracted: boolean
  // > 0 when any UI element is hovered (ref-counted for overlapping hovers)
  pupilDilateCount: number
  // true once GPUWarmup has uploaded textures and compiled shaders
  gpuReady: boolean

  setScrollT: (t: number) => void
  setChatMode: (mode: boolean) => void
  setUserHasInteracted: (interacted: boolean) => void
  setGpuReady: (ready: boolean) => void
  pupilDilate: () => void
  pupilContract: () => void
}

export const useStore = create<StoreState>()((set) => ({
  scrollT: 0,
  activeScene: 0,
  chatMode: false,
  userHasInteracted: false,
  gpuReady: false,

  setScrollT: (t: number) =>
    set({
      scrollT: t,
      activeScene: computeActiveScene(t),
    }),

  setChatMode: (mode: boolean) => set({ chatMode: mode }),

  setUserHasInteracted: (interacted: boolean) => set({ userHasInteracted: interacted }),

  setGpuReady: (ready: boolean) => set({ gpuReady: ready }),

  pupilDilateCount: 0,
  pupilDilate: () => set((s) => ({ pupilDilateCount: s.pupilDilateCount + 1 })),
  pupilContract: () => set((s) => ({ pupilDilateCount: Math.max(0, s.pupilDilateCount - 1) })),
}))
