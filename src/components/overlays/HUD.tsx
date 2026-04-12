'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { useStore } from '@/store/useStore'

// ─── Personal links ──────────────────────────────────────────────────────────
const LINKS = {
  github: 'https://github.com/RiadBsr',
  linkedin: 'https://linkedin.com/in/RiadBsr',
  resume: '/resume.pdf',
}

// Scene labels and target scrollT values for the right-edge ticker.
// Values are dwell midpoints from CameraRig TIMELINE.
const SCENES = [
  { label: 'S·0', t: 0 },
  { label: 'S·1', t: 0.30 },
  { label: 'S·2', t: 0.47 },
  { label: 'S·3', t: 0.54 },
  { label: 'S·4', t: 0.62 },
  { label: 'S·5', t: 0.70 },
  { label: 'S·6', t: 0.78 },
  { label: 'S·7', t: 0.86 },
  { label: 'S·8', t: 0.95 },
]

const mono: CSSProperties = {
  fontFamily: 'var(--font-space-mono, monospace)',
}

const ctaLink: CSSProperties = {
  ...mono,
  fontSize: '12px',
  letterSpacing: '0.18em',
  color: 'rgba(255,255,255,0.78)',
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.22)',
  padding: '5px 10px',
  background: 'none',
  cursor: 'pointer',
  display: 'inline-block',
}

export function HUD() {
  const scrollT = useStore((s) => s.scrollT)
  const activeScene = useStore((s) => s.activeScene)
  const chatMode = useStore((s) => s.chatMode)
  const setScrollT = useStore((s) => s.setScrollT)
  const setChatMode = useStore((s) => s.setChatMode)
  const pupilDilate = useStore((s) => s.pupilDilate)
  const pupilContract = useStore((s) => s.pupilContract)

  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      if (!e.matches) setMenuOpen(false)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
          fontSize: '13px',
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.5)',
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

      {/* ── Top-right: desktop CTAs ── */}
      {!isMobile && (
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
            href={LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={pupilDilate}
            onMouseLeave={pupilContract}
            style={ctaLink}
          >
            GITHUB
          </a>
          <a
            href={LINKS.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={pupilDilate}
            onMouseLeave={pupilContract}
            style={ctaLink}
          >
            LINKEDIN
          </a>
          <a
            href={LINKS.resume}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={pupilDilate}
            onMouseLeave={pupilContract}
            style={ctaLink}
          >
            RESUME
          </a>
        </div>
      )}

      {/* ── Top-right: mobile hamburger + dropdown ── */}
      {isMobile && (
        <>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            onMouseEnter={pupilDilate}
            onMouseLeave={pupilContract}
            style={{
              position: 'absolute',
              top: 16,
              right: 24,
              ...mono,
              fontSize: '12px',
              letterSpacing: '0.18em',
              color: menuOpen ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)',
              border: menuOpen
                ? '1px solid rgba(255,255,255,0.35)'
                : '1px solid rgba(255,255,255,0.22)',
              padding: '5px 10px',
              background: menuOpen ? 'rgba(255,255,255,0.08)' : 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'all 0.2s',
            }}
          >
            {menuOpen ? 'CLOSE' : 'MENU'}
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'stretch',
                pointerEvents: 'auto',
                background: 'rgba(5,5,5,0.88)',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '8px',
              }}
            >
              <a
                href={LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={pupilDilate}
                onMouseLeave={pupilContract}
                style={{ ...ctaLink, textAlign: 'center' }}
              >
                GITHUB
              </a>
              <a
                href={LINKS.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={pupilDilate}
                onMouseLeave={pupilContract}
                style={{ ...ctaLink, textAlign: 'center' }}
              >
                LINKEDIN
              </a>
              <a
                href={LINKS.resume}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={pupilDilate}
                onMouseLeave={pupilContract}
                style={{ ...ctaLink, textAlign: 'center' }}
              >
                RESUME
              </a>
            </div>
          )}
        </>
      )}

      {/* ── Right edge: scene ticker ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: 20,
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
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
              fontSize: '12px',
              letterSpacing: '0.12em',
              color:
                i === activeScene
                  ? 'rgba(255,255,255,0.88)'
                  : 'rgba(255,255,255,0.5)',
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
          fontSize: '12px',
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.56)',
        }}
      >
        z = {zLabel}
      </div>

      {/* ── Bottom-right: CHAT button — hidden when panel is open (panel has its own close) ── */}
      {!chatMode && (
        <button
          onClick={() => { pupilContract(); setChatMode(true) }}
          onMouseEnter={pupilDilate}
          onMouseLeave={pupilContract}
          style={{
            position: 'absolute',
            bottom: 16,
            right: 24,
            ...mono,
            fontSize: '12px',
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(255,255,255,0.22)',
            padding: '5px 10px',
            background: 'none',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'all 0.2s',
          }}
        >
          CHAT
        </button>
      )}
    </div>
  )
}
