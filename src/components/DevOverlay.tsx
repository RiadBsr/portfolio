'use client'

import { useStore } from '@/store/useStore'
import type { CSSProperties } from 'react'

/**
 * DevOverlay — reusable "Work in Progress" overlay for unfinished scenes.
 *
 * Blurs the 3D canvas and displays a centered WIP message once scrollT
 * crosses a configurable threshold. As development progresses, update
 * `fromScrollT` to match the entrance of the first unfinished scene.
 *
 * Usage:
 *   <DevOverlay fromScrollT={0.14} />
 *
 * Props:
 *   fromScrollT — scrollT value at which the overlay begins fading in.
 *                 Set this to the enterStart of the first unfinished scene.
 *   fadeRange  — scrollT range over which blur/opacity ramp from 0→1.
 *                Defaults to 0.04 (~240 virtual px of scroll).
 *
 * To remove when all scenes are done: simply delete the <DevOverlay /> from page.tsx.
 */

interface DevOverlayProps {
  fromScrollT: number
  fadeRange?: number
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-space-mono, monospace)',
}

export function DevOverlay({ fromScrollT, fadeRange = 0.04 }: DevOverlayProps) {
  const scrollT = useStore((s) => s.scrollT)

  if (scrollT < fromScrollT) return null

  // 0 → 1 over the fadeRange
  const progress = Math.min(1, (scrollT - fromScrollT) / fadeRange)

  const blurPx = progress * 12
  const opacity = progress

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5,
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
        backgroundColor: `rgba(5, 5, 5, ${0.4 * opacity})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        transition: 'backdrop-filter 0.1s',
      }}
    >
      <p
        style={{
          ...mono,
          fontSize: 'clamp(14px, 3vw, 28px)',
          letterSpacing: '0.35em',
          color: `rgba(255, 255, 255, ${0.6 * opacity})`,
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        WORK IN PROGRESS
      </p>
      <p
        style={{
          ...mono,
          fontSize: 'clamp(10px, 1.5vw, 14px)',
          letterSpacing: '0.2em',
          color: `rgba(255, 255, 255, ${0.3 * opacity})`,
          textTransform: 'uppercase',
          marginTop: '16px',
        }}
      >
        MORE SCENES COMING SOON
      </p>
    </div>
  )
}
