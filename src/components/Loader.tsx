'use client'

import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

export function Loader() {
  const { progress, active } = useProgress()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Once loading completes, fade out then unmount
    if (!active && progress === 100) {
      const id = setTimeout(() => setVisible(false), 600)
      return () => clearTimeout(id)
    }
  }, [active, progress])

  if (!visible) return null

  const done = !active && progress === 100

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
        transition: 'opacity 0.5s ease-out',
        opacity: done ? 0 : 1,
        pointerEvents: done ? 'none' : 'all',
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          width: 160,
          height: 1,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'var(--accent, #E0E0D8)',
            transition: 'width 0.3s ease-out',
          }}
        />
      </div>
      <span
        style={{
          marginTop: 12,
          fontFamily: 'var(--font-space-mono, monospace)',
          fontSize: 10,
          letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase',
        }}
      >
        {Math.round(progress)}%
      </span>
    </div>
  )
}
