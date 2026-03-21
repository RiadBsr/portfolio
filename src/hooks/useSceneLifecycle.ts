'use client'

import { useStore } from '@/store/useStore'
import { easeInOut } from '@/utils/easing'

export interface SceneLifecycleConfig {
  enterStart: number
  enterEnd: number
  exitStart: number
  disposeAt: number
}

export interface SceneLifecycleState {
  phase: 'idle' | 'entering' | 'dwelling' | 'exiting' | 'disposed'
  enterProgress: number
  dwellProgress: number
  exitProgress: number
  visible: boolean
  shouldMount: boolean
}

export function useSceneLifecycle(config: SceneLifecycleConfig): SceneLifecycleState {
  const scrollT = useStore((s) => s.scrollT)
  const { enterStart, enterEnd, exitStart, disposeAt } = config

  if (scrollT < enterStart) {
    return { phase: 'idle', enterProgress: 0, dwellProgress: 0, exitProgress: 0, visible: false, shouldMount: true }
  }
  if (scrollT >= disposeAt) {
    return { phase: 'disposed', enterProgress: 1, dwellProgress: 1, exitProgress: 1, visible: false, shouldMount: false }
  }
  if (scrollT < enterEnd) {
    const p = easeInOut((scrollT - enterStart) / (enterEnd - enterStart))
    return { phase: 'entering', enterProgress: p, dwellProgress: 0, exitProgress: 0, visible: true, shouldMount: true }
  }
  if (scrollT < exitStart) {
    const p = easeInOut((scrollT - enterEnd) / (exitStart - enterEnd))
    return { phase: 'dwelling', enterProgress: 1, dwellProgress: p, exitProgress: 0, visible: true, shouldMount: true }
  }
  const p = easeInOut((scrollT - exitStart) / (disposeAt - exitStart))
  return { phase: 'exiting', enterProgress: 1, dwellProgress: 1, exitProgress: p, visible: true, shouldMount: true }
}
