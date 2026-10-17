'use client'

import { useStore } from '@/store/useStore'
import { LINKS, CtaLink, ctaLink } from '@/components/overlays/HUD'
import type { CSSProperties } from 'react'

/**
 * DevOverlay — end card shown after the last finished scene.
 *
 * Blurs the 3D canvas once scrollT crosses a configurable threshold and shows
 * the contact CTAs (resume, AI chat, email, LinkedIn, GitHub) plus a small
 * "more scenes coming soon" notice, so visitors never hit a dead end.
 * As development progresses, update `fromScrollT` to match the entrance of
 * the first unfinished scene.
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
 * When all scenes are done, the S-8 conversion scene replaces this component.
 */

interface DevOverlayProps {
  fromScrollT: number
  fadeRange?: number
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-space-mono, monospace)',
}

const SECONDARY_CTAS = [
  { label: 'RESUME', href: LINKS.resume },
  { label: 'EMAIL', href: LINKS.email },
  { label: 'LINKEDIN', href: LINKS.linkedin },
  { label: 'GITHUB', href: LINKS.github },
]

export function DevOverlay({ fromScrollT, fadeRange = 0.04 }: DevOverlayProps) {
  const scrollT = useStore((s) => s.scrollT)
  const chatMode = useStore((s) => s.chatMode)
  const setChatMode = useStore((s) => s.setChatMode)

  if (scrollT < fromScrollT || chatMode) return null

  // 0 → 1 over the fadeRange
  const progress = Math.min(1, (scrollT - fromScrollT) / fadeRange)

  const blurPx = progress * 12

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5,
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
        backgroundColor: `rgba(5, 5, 5, ${0.55 * progress})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        padding: '0 24px',
        textAlign: 'center',
        opacity: progress,
        // Only clickable once mostly faded in, so it never steals scroll-through clicks
        pointerEvents: progress > 0.6 ? 'auto' : 'none',
        transition: 'backdrop-filter 0.1s',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-bebas, sans-serif)',
          fontSize: 'clamp(44px, 7vw, 96px)',
          letterSpacing: '0.04em',
          lineHeight: 0.95,
          color: 'rgba(255, 255, 255, 0.92)',
          margin: 0,
        }}
      >
        LET&apos;S TALK
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-dm-sans, sans-serif)',
          fontSize: 'clamp(14px, 1.3vw, 17px)',
          lineHeight: 1.6,
          color: 'rgba(255, 255, 255, 0.62)',
          maxWidth: 460,
          margin: 0,
        }}
      >
        AI &amp; Computer Vision engineer in Paris. I take deep learning, synthetic
        data and 3D from research to production.
      </p>

      <button
        onClick={() => setChatMode(true)}
        style={{
          ...ctaLink,
          marginTop: 8,
          padding: '10px 18px',
          color: '#050505',
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
        }}
      >
        ASK MY AI CLONE
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
        {SECONDARY_CTAS.map(({ label, href }) => (
          <CtaLink key={label} href={href} style={ctaLink}>
            {label}
          </CtaLink>
        ))}
      </div>

      <p
        style={{
          ...mono,
          fontSize: '11px',
          letterSpacing: '0.2em',
          color: 'rgba(255, 255, 255, 0.4)',
          textTransform: 'uppercase',
          marginTop: 18,
          marginBottom: 0,
        }}
      >
        More scenes coming soon
      </p>
    </div>
  )
}
