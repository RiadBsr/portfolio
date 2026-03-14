'use client'

import { create } from 'zustand'

// Scene activation boundaries — the scrollT value at which each scene
// becomes the "active" scene (drives camera look-at focal point).
// Aligned with storyboard enter-start percentages.
// Boundaries shifted to account for the 10% intro phase (INTRO_T=0.10).
// Formula: new = 0.10 + old * 0.90  (except S-0 which stays at 0)
const SCENE_BOUNDARIES = [0, 0.23, 0.48, 0.55, 0.62, 0.69, 0.77, 0.86, 0.95] as const

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
