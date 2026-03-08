'use client'

import type { CSSProperties } from 'react'
import { useStore } from '@/store/useStore'

// Scene labels and target scrollT values for the right-edge ticker.
// Target values are the dwell midpoints from the storyboard.
const SCENES = [
  { label: 'S·0', t: 0 },
  { label: 'S·1', t: 0.11 },
  { label: 'S·2', t: 0.28 },
  { label: 'S·3', t: 0.43 },
  { label: 'S·4', t: 0.53 },
  { label: 'S·5', t: 0.64 },
  { label: 'S·6', t: 0.76 },
  { label: 'S·7', t: 0.86 },
  { label: 'S·8', t: 0.95 },
]

const mono: CSSProperties = {
  fontFamily: 'var(--font-space-mono, monospace)',
}

export function HUD() {
  const scrollT = useStore((s) => s.scrollT)
  const activeScene = useStore((s) => s.activeScene)
  const chatMode = useStore((s) => s.chatMode)
  const setScrollT = useStore((s) => s.setScrollT)
  const pupilDilate = useStore((s) => s.pupilDilate)
  const pupilContract = useStore((s) => s.pupilContract)

  const zLabel = chatMode ? 'CHAT_MODE' : scrollT.toFixed(3)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* ── Top-left: name (click to return to S-0) ── */}
      <button
        onClick={() => setScrollT(0)}
        onMouseEnter={pupilDilate}
        onMouseLeave={pupilContract}
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          ...mono,
          fontSize: '9px',
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.12)',
          textTransform: 'uppercase',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          pointerEvents: 'auto',
          padding: 0,
        }}
      >
        RIAD BOUSSOURA
      </button>

      {/* ── Top-right: CTAs ── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 24,
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          pointerEvents: 'auto',
        }}
      >
        <a
          href="/resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={pupilDilate}
          onMouseLeave={pupilContract}
          style={{
            ...mono,
            fontSize: '9px',
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.35)',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '4px 10px',
          }}
        >
          RESUME
        </a>
        {/* Chat activated in Phase 3 */}
        <span
          style={{
            ...mono,
            fontSize: '9px',
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.04)',
            padding: '4px 10px',
          }}
          title="Chat — coming in Phase 3"
        >
          CHAT
        </span>
      </div>

      {/* ── Right edge: scene ticker ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: 20,
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'flex-end',
          pointerEvents: 'auto',
        }}
      >
        {SCENES.map((scene, i) => (
          <button
            key={i}
            onClick={() => setScrollT(scene.t)}
            onMouseEnter={pupilDilate}
            onMouseLeave={pupilContract}
            style={{
              ...mono,
              fontSize: '8px',
              letterSpacing: '0.12em',
              color:
                i === activeScene
                  ? 'rgba(255,255,255,0.5)'
                  : 'rgba(255,255,255,0.1)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 0',
              transition: 'color 0.3s',
            }}
          >
            {scene.label}
          </button>
        ))}
      </div>

      {/* ── Bottom-left: latent z-coordinate counter ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 24,
          ...mono,
          fontSize: '10px',
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.08)',
        }}
      >
        z = {zLabel}
      </div>

      {/* ── Bottom-right: mobile Chat button — Phase 3 ── */}
    </div>
  )
}
