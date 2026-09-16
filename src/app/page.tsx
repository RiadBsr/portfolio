import type { CSSProperties } from 'react'

/**
 * Pause screen — the only page this site serves while it is offline.
 *
 * Deliberately a server component with no client JS, no 3D canvas, no assets
 * and no personal information of any kind. Every other route (the portfolio,
 * the chat API, models, textures, the resume) is sealed off in
 * `src/proxy.ts`.
 *
 * To bring the site back, see "Paused state" in README.md.
 */

const mono: CSSProperties = {
  fontFamily: 'var(--font-space-mono, monospace)',
  textTransform: 'uppercase',
  margin: 0,
}

export default function Paused() {
  return (
    <main
      style={{
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '24px',
        backgroundColor: 'var(--black)',
      }}
    >
      <p
        className="pause-pulse"
        style={{
          ...mono,
          fontSize: 'clamp(14px, 3vw, 28px)',
          letterSpacing: '0.35em',
          textIndent: '0.35em',
          color: 'rgba(255, 255, 255, 0.6)',
          textAlign: 'center',
        }}
      >
        Work in Progress
      </p>

      <span
        aria-hidden="true"
        style={{
          width: 'min(180px, 40vw)',
          height: '1px',
          backgroundColor: 'var(--wire-bright)',
        }}
      />

      <p
        style={{
          ...mono,
          fontSize: 'clamp(10px, 1.5vw, 14px)',
          letterSpacing: '0.2em',
          textIndent: '0.2em',
          color: 'rgba(255, 255, 255, 0.3)',
          textAlign: 'center',
          lineHeight: 1.8,
        }}
      >
        This site is temporarily offline
      </p>
    </main>
  )
}
