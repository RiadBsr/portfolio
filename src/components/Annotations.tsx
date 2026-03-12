'use client'

import { useMemo, useState, useCallback, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useStore } from '@/store/useStore'
import * as THREE from 'three'

const ANNOTATIONS = [
  {
    id: 'mesh',
    pos: [0.12, 0.10, -0.12] as [number, number, number],
    label: 'TOPOLOGY',
    detail: 'Verts: 1,332 | Edges: 3,024 | Faces: 1,700',
    delay: '0s',
    flip: false,
  },
  {
    id: 'edges',
    pos: [-0.12, 0.05, -0.12] as [number, number, number],
    label: 'DIGITAL SCULPT',
    detail: 'Low poly representation of Riad Boussoura (more smiley IRL)',
    delay: '0.1s',
    flip: true,
  },
  {
    id: 'rig',
    pos: [0.10, -0.1, -0.12] as [number, number, number],
    label: 'SKELETAL RIG',
    detail: 'Fully rigged in Blender with pupil dilatation interactivity',
    delay: '0.2s',
    flip: false,
  },
]

const FADE_START = 0.04
const FADE_END = 0.18

const LINE_COLLAPSED = 28
const LINE_EXPANDED = 64
const LINE_MOBILE = 18

// Shared invisible material and geometry for hover hitboxes (allocated once)
const invisibleMat = /* @__PURE__ */ new THREE.MeshBasicMaterial({ visible: false })
const hitboxGeo = /* @__PURE__ */ new THREE.SphereGeometry(0.06, 8, 8)

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
  const revealed = useRef(false)

  const pupilDilate = useStore((s) => s.pupilDilate)
  const pupilContract = useStore((s) => s.pupilContract)

  const onOver = useCallback(() => { setHovered(true); pupilDilate() }, [pupilDilate])
  const onOut = useCallback(() => { setHovered(false); pupilContract() }, [pupilContract])
  const onAnimEnd = useCallback(() => { revealed.current = true }, [])

  const lineW = isMobile ? LINE_MOBILE : (hovered ? LINE_EXPANDED : LINE_COLLAPSED)
  const flip = ann.flip

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
                />
                <circle
                  cx={flip ? lineW : 0}
                  cy="0"
                  r={isMobile ? 1.5 : 1.8}
                  fill={hovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'}
                  style={{ transition: 'fill 0.3s ease' }}
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
  const chatMode = useStore((s) => s.chatMode)
  const { size } = useThree()
  const isMobile = size.width < 768

  const opacity = useMemo(() => {
    if (scrollT <= FADE_START) return 1
    if (scrollT >= FADE_END) return 0
    return 1 - (scrollT - FADE_START) / (FADE_END - FADE_START)
  }, [scrollT])

  if (opacity <= 0 || chatMode) return null

  return (
    <>
      {ANNOTATIONS.map((ann) => (
        <AnnotationItem key={ann.id} ann={ann} opacity={opacity} isMobile={isMobile} />
      ))}
    </>
  )
}
