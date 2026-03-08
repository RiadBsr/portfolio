'use client'

import { useMemo, useState, useCallback, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '@/store/useStore'
import * as THREE from 'three'

const ANNOTATIONS = [
  {
    id: 'mesh',
    pos: [0.12, 0.10, -0.12] as [number, number, number],
    label: 'NEURAL MESH',
    detail: 'Skeletal wireframe extracted from skinned geometry boundary edges',
    delay: '0s',
  },
  {
    id: 'edges',
    pos: [-0.12, 0.05, -0.12] as [number, number, number],
    label: 'EDGE DETECT',
    detail: 'Sharp edges rendered via custom skinning shader on LineSegments',
    delay: '0.1s',
  },
  {
    id: 'rig',
    pos: [0.10, -0.1, -0.12] as [number, number, number],
    label: 'BONE RIG',
    detail: 'Quaternion-damped bone tracking for gaze and blink animation',
    delay: '0.2s',
  },
]

const FADE_START = 0.04
const FADE_END = 0.18

const LINE_COLLAPSED = 28
const LINE_EXPANDED = 64
const LINE_MOBILE = 18

// Shared invisible material for hover hitboxes
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false })
const hitboxGeo = new THREE.SphereGeometry(0.06, 8, 8)

// Reusable vector for projection
const _vec3 = new THREE.Vector3()

function AnnotationItem({
  ann,
  opacity,
  isMobile,
}: {
  ann: (typeof ANNOTATIONS)[number]
  opacity: number
  isMobile: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [flip, setFlip] = useState(false)
  const revealed = useRef(false)

  const onOver = useCallback(() => setHovered(true), [])
  const onOut = useCallback(() => setHovered(false), [])
  const onAnimEnd = useCallback(() => { revealed.current = true }, [])

  // Auto-flip: project annotation position to screen, flip if on left half
  useFrame(({ camera }) => {
    _vec3.set(ann.pos[0], ann.pos[1], ann.pos[2]).project(camera)
    const shouldFlip = _vec3.x < -0.05
    if (shouldFlip !== flip) setFlip(shouldFlip)
  })

  const lineW = isMobile ? LINE_MOBILE : (hovered ? LINE_EXPANDED : LINE_COLLAPSED)

  return (
    <>
      {/* Invisible 3D hitbox for hover — desktop only */}
      {!isMobile && (
        <mesh
          position={ann.pos}
          geometry={hitboxGeo}
          material={invisibleMat}
          onPointerOver={onOver}
          onPointerOut={onOut}
        />
      )}
      <Html position={ann.pos} style={{ pointerEvents: 'none' }}>
        {/* Zero-size anchor: dot is always at the 3D coordinate */}
        <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
          <div
            onAnimationEnd={onAnimEnd}
            style={{
              position: 'absolute',
              left: flip ? 'auto' : '0px',
              right: flip ? '0px' : 'auto',
              top: '0px',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: flip ? 'flex-end' : 'flex-start',
              pointerEvents: 'none',
              opacity: revealed.current ? opacity : undefined,
              animation: revealed.current
                ? undefined
                : `holoReveal 0.9s ease-out ${ann.delay} both`,
            }}
          >
            {/* Label row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '4px' : '6px',
                flexDirection: flip ? 'row-reverse' : 'row',
              }}
            >
              {/* Dot + line */}
              <svg
                width={lineW}
                height="2"
                style={{
                  overflow: 'visible',
                  flexShrink: 0,
                  transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                <line
                  x1={flip ? lineW : 0}
                  y1="0"
                  x2={flip ? 0 : lineW}
                  y2="0"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="0.8"
                  style={{ transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)' }}
                />
                <circle
                  cx={flip ? lineW : 0}
                  cy="0"
                  r={isMobile ? 1.5 : 1.8}
                  fill={hovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'}
                  style={{ transition: 'fill 0.3s ease, cx 0.4s cubic-bezier(0.22,1,0.36,1)' }}
                />
              </svg>
              <span
                style={{
                  fontFamily: 'var(--font-space-mono, monospace)',
                  fontSize: isMobile ? '7px' : '8px',
                  letterSpacing: isMobile ? '0.12em' : '0.18em',
                  color: hovered ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                  textTransform: 'uppercase',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.3s ease',
                  textShadow: hovered ? '0 0 6px rgba(255,255,255,0.3)' : 'none',
                }}
              >
                {ann.label}
              </span>
            </div>

            {/* Detail row — desktop hover only */}
            {!isMobile && (
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: hovered ? '30px' : '0px',
                  opacity: hovered ? 1 : 0,
                  transition:
                    'max-height 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
                  marginTop: '3px',
                  paddingLeft: flip ? '0' : `${lineW + 6}px`,
                  paddingRight: flip ? `${lineW + 6}px` : '0',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-space-mono, monospace)',
                    fontSize: '6.5px',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.3)',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    display: 'block',
                    textAlign: flip ? 'right' : 'left',
                  }}
                >
                  {ann.detail}
                </span>
              </div>
            )}
          </div>
        </div>
      </Html>
    </>
  )
}

export function Annotations() {
  const scrollT = useStore((s) => s.scrollT)
  const { size } = useThree()
  const isMobile = size.width < 768

  const opacity = useMemo(() => {
    if (scrollT <= FADE_START) return 1
    if (scrollT >= FADE_END) return 0
    return 1 - (scrollT - FADE_START) / (FADE_END - FADE_START)
  }, [scrollT])

  if (opacity <= 0) return null

  return (
    <>
      {ANNOTATIONS.map((ann) => (
        <AnnotationItem key={ann.id} ann={ann} opacity={opacity} isMobile={isMobile} />
      ))}
    </>
  )
}
