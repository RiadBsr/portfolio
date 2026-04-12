'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
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
    detail: 'Low poly representation of Riad Boussoura\n(more smiley IRL)',
    delay: '0.4s',
    flip: true,
  },
  {
    id: 'rig',
    pos: [0.10, -0.1, -0.12] as [number, number, number],
    label: 'SKELETAL RIG',
    detail: 'Fully rigged in Blender',
    delay: '0.8s',
    flip: false,
  },
]

const FADE_START = 0.03
const FADE_END = 0.07

const LINE_COLLAPSED = 34
const LINE_EXPANDED = 72
const LINE_MOBILE = 26

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
  // Track hover in a ref so the unmount cleanup can read the current value
  const isHoveredRef = useRef(false)

  const pupilDilate = useStore((s) => s.pupilDilate)
  const pupilContract = useStore((s) => s.pupilContract)

  const onOver = useCallback(() => {
    isHoveredRef.current = true
    setHovered(true)
    pupilDilate()
  }, [pupilDilate])

  const onOut = useCallback(() => {
    isHoveredRef.current = false
    setHovered(false)
    pupilContract()
  }, [pupilContract])

  // When the component unmounts mid-hover (scroll fades it out), release the pupil
  useEffect(() => {
    return () => { if (isHoveredRef.current) pupilContract() }
  }, [pupilContract])

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
        {/* Zero-size anchor at the 3D point. Dot is pinned; line grows outward;
            label+detail track lineW with the same eased transition so nothing jumps. */}
        <div
          onAnimationEnd={onAnimEnd}
          style={{
            position: 'relative',
            width: 0,
            height: 0,
            pointerEvents: 'none',
            opacity: revealed.current ? opacity : undefined,
            animation: revealed.current
              ? undefined
              : `holoReveal 0.9s ease-out ${ann.delay} both`,
          }}
        >
          {/* Dot — pinned exactly at the 3D anchor */}
          <div
            style={{
              position: 'absolute',
              left: '0px',
              top: '0px',
              width: `${(isMobile ? 1.5 : 1.8) * 2}px`,
              height: `${(isMobile ? 1.5 : 1.8) * 2}px`,
              borderRadius: '50%',
              background: hovered ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.72)',
              transform: 'translate(-50%, -50%)',
              transition: 'background 0.3s ease',
            }}
          />
          {/* Horizontal line — grows outward from the dot in the flip direction */}
          <div
            style={{
              position: 'absolute',
              left: flip ? 'auto' : '0px',
              right: flip ? '0px' : 'auto',
              top: '0px',
              width: `${lineW}px`,
              height: '1px',
              background: 'rgba(255,255,255,0.5)',
              transform: 'translateY(-50%)',
              transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
            }}
          />
          {/* Label + detail stack — anchored to the far end of the line, tracks lineW */}
          <div
            style={{
              position: 'absolute',
              left: flip ? 'auto' : `${lineW + (isMobile ? 4 : 6)}px`,
              right: flip ? `${lineW + (isMobile ? 4 : 6)}px` : 'auto',
              top: '0px',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: flip ? 'flex-end' : 'flex-start',
              pointerEvents: 'none',
              transition:
                'left 0.4s cubic-bezier(0.22,1,0.36,1), right 0.4s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-space-mono, monospace)',
                fontSize: isMobile ? '10px' : '12px',
                letterSpacing: isMobile ? '0.12em' : '0.18em',
                color: hovered ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.8)',
                textTransform: 'uppercase',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                transition: 'color 0.3s ease',
                textShadow: hovered ? '0 0 6px rgba(255,255,255,0.3)' : 'none',
              }}
            >
              {ann.label}
            </span>
            {!isMobile && (
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: hovered ? '42px' : '0px',
                  opacity: hovered ? 1 : 0,
                  transition:
                    'max-height 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
                  marginTop: hovered ? '3px' : '0px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-space-mono, monospace)',
                    fontSize: '9.5px',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.72)',
                    userSelect: 'none',
                    whiteSpace: 'pre',
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

export function HeadAnnotations() {
  const scrollT = useStore((s) => s.scrollT)
  const chatMode = useStore((s) => s.chatMode)
  const gpuReady = useStore((s) => s.gpuReady)
  const { size } = useThree()
  const isMobile = size.width < 768

  const opacity = useMemo(() => {
    if (scrollT <= FADE_START) return 1
    if (scrollT >= FADE_END) return 0
    return 1 - (scrollT - FADE_START) / (FADE_END - FADE_START)
  }, [scrollT])

  // Wait until loader is done so holoReveal animations play after the scene is visible
  if (opacity <= 0 || chatMode || !gpuReady) return null

  return (
    <>
      {ANNOTATIONS.map((ann) => (
        <AnnotationItem key={ann.id} ann={ann} opacity={opacity} isMobile={isMobile} />
      ))}
    </>
  )
}
