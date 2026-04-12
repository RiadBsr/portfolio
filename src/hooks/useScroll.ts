'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'

// Total virtual scroll distance. The user scrolls through 6000px worth
// of input to move scrollT from 0 → 1 along the path.
const VIRTUAL_HEIGHT = 6000

// Hard scroll ceiling — prevents scrolling past the last finished scene.
// Matches DevOverlay fromScrollT + fadeRange so the user hits the WIP wall.
// Update this as new scenes ship. Remove when all scenes are complete.
const SCROLL_T_MAX = 0.40

// Exponential smoothing speed (higher = snappier camera feel).
// 10 gives a TikTok-like fast attack with smooth settling.
const SMOOTH_SPEED = 10

// Scene-aware scroll speed — slow down in dwell ranges so the user's
// scroll input primarily drives scene animations, not camera travel.
// Aligned with CameraRig PATH_SEGMENTS.
function getScrollSpeedMultiplier(t: number): number {
  if (t <= 0.12) return 0.3                       // S-0 Head dwell (annotations)
  if (t >= 0.24 && t <= 0.36) return 0.15         // S-1 GoPro dwell (animations)
  return 1.0                                       // Transitions + future
}

export function useScroll() {
  const setScrollT = useStore((s) => s.setScrollT)
  const setUserHasInteracted = useStore((s) => s.setUserHasInteracted)

  // Raw accumulated target (virtual pixels, not yet smoothed)
  const targetRef = useRef(0)
  // Smoothed position (virtual pixels) — camera reads this via scrollT
  const currentRef = useRef(0)
  const rafIdRef = useRef(0)
  const touchYRef = useRef(0)

  useEffect(() => {
    let lastTime = 0

    function tick(time: number) {
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0
      lastTime = time

      // Only drive scrollT after the user has taken control.
      // Before that, useAutoDrift owns scrollT and we must not override it.
      if (useStore.getState().userHasInteracted && !useStore.getState().chatMode) {
        const factor = delta ? 1 - Math.exp(-SMOOTH_SPEED * delta) : 0
        currentRef.current += (targetRef.current - currentRef.current) * factor
        setScrollT(Math.max(0, Math.min(1, currentRef.current / VIRTUAL_HEIGHT)))
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    // On first user input, sync the accumulator to wherever auto-drift left
    // scrollT so there is no jump when the user takes manual control.
    function syncFromStore() {
      if (!useStore.getState().userHasInteracted) {
        const t = useStore.getState().scrollT
        currentRef.current = t * VIRTUAL_HEIGHT
        targetRef.current = currentRef.current
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (useStore.getState().chatMode) return
      syncFromStore()
      setUserHasInteracted(true)
      const currentT = targetRef.current / VIRTUAL_HEIGHT
      const speed = getScrollSpeedMultiplier(currentT)
      const maxPx = SCROLL_T_MAX * VIRTUAL_HEIGHT
      targetRef.current = Math.max(
        0,
        Math.min(maxPx, targetRef.current + e.deltaY * speed)
      )
    }

    function onTouchStart(e: TouchEvent) {
      touchYRef.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      if (useStore.getState().chatMode) return
      const deltaY = touchYRef.current - e.touches[0].clientY
      touchYRef.current = e.touches[0].clientY
      syncFromStore()
      setUserHasInteracted(true)
      const currentT = targetRef.current / VIRTUAL_HEIGHT
      const speed = getScrollSpeedMultiplier(currentT)
      const maxPx = SCROLL_T_MAX * VIRTUAL_HEIGHT
      // ×2 multiplier so touch swipe feels as responsive as wheel
      targetRef.current = Math.max(
        0,
        Math.min(maxPx, targetRef.current + deltaY * 2 * speed)
      )
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    rafIdRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      cancelAnimationFrame(rafIdRef.current)
    }
  }, [setScrollT, setUserHasInteracted])
}
