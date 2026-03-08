'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

const IDLE_DELAY = 3500   // ms of idle before drift starts
const DRIFT_SPEED = 0.005 // scroll progress added per second (0.5 % / s)

export function useAutoDrift() {
  const setScrollT = useStore((s) => s.setScrollT)

  useEffect(() => {
    let rafId = 0
    let lastTime = 0

    function drift(time: number) {
      const { userHasInteracted, chatMode, scrollT } = useStore.getState()

      // Stop permanently the moment the user takes manual control
      if (userHasInteracted) return

      if (!chatMode && lastTime) {
        const delta = Math.min((time - lastTime) / 1000, 0.1)
        setScrollT(Math.min(1, scrollT + DRIFT_SPEED * delta))
      }

      lastTime = time
      rafId = requestAnimationFrame(drift)
    }

    const timer = setTimeout(() => {
      // Only start if the user still hasn't interacted after the idle window
      if (!useStore.getState().userHasInteracted) {
        rafId = requestAnimationFrame(drift)
      }
    }, IDLE_DELAY)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(rafId)
    }
  }, [setScrollT])
}
