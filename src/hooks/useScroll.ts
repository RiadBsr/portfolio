'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'

// Total virtual scroll distance. The user scrolls through 6000px worth
// of input to move scrollT from 0 → 1 along the path.
const VIRTUAL_HEIGHT = 6000

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

// Adds a wheel/touch delta (virtual px) to the store's scroll target.
// Before the first interaction auto-drift owns scrollT, so start from there.
function nudge(deltaPx: number) {
  const { userHasInteracted, scrollT, scrollTarget, scrollTo } = useStore.getState()
  const base = userHasInteracted ? scrollTarget : scrollT
  scrollTo(base + (deltaPx * getScrollSpeedMultiplier(base)) / VIRTUAL_HEIGHT)
}

export function useScroll() {
  const setScrollT = useStore((s) => s.setScrollT)

  // Smoothed position (0 → 1) — camera reads this via scrollT
  const currentRef = useRef(0)
  const rafIdRef = useRef(0)
  const touchYRef = useRef(0)

  useEffect(() => {
    let lastTime = 0

    function tick(time: number) {
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0
      lastTime = time

      const { userHasInteracted, chatMode, scrollT, scrollTarget } = useStore.getState()
      if (!userHasInteracted) {
        // useAutoDrift owns scrollT — track it so the handoff never jumps
        currentRef.current = scrollT
      } else if (!chatMode) {
        const factor = delta ? 1 - Math.exp(-SMOOTH_SPEED * delta) : 0
        currentRef.current += (scrollTarget - currentRef.current) * factor
        setScrollT(currentRef.current)
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    function onWheel(e: WheelEvent) {
      // In chat mode let the wheel through so the chat history can scroll
      if (useStore.getState().chatMode) return
      e.preventDefault()
      nudge(e.deltaY)
    }

    function onTouchStart(e: TouchEvent) {
      touchYRef.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      if (useStore.getState().chatMode) return
      const deltaY = touchYRef.current - e.touches[0].clientY
      touchYRef.current = e.touches[0].clientY
      // ×2 multiplier so touch swipe feels as responsive as wheel
      nudge(deltaY * 2)
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
  }, [setScrollT])
}
