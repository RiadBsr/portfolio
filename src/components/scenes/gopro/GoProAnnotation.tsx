'use client'

import * as THREE from 'three'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { SceneLifecycleState } from '@/hooks/useSceneLifecycle'
import { useStore } from '@/store/useStore'

// Interactive annotation pointing at the GoPro camera body. Mirrors the head
// annotation style: pinned dot + growing line + label, hover expands detail,
// `holoReveal` CSS animation plays on every hidden → visible transition.
// Anchored in the inner hemisphere group so it rides scene rotation and sits
// just above the camera body.
const POS: [number, number, number] = [0, 0.28, 0]
const HITBOX_GEO = /* @__PURE__ */ new THREE.SphereGeometry(0.18, 12, 12)
const HITBOX_MAT = /* @__PURE__ */ new THREE.MeshBasicMaterial({ visible: false })
const LINE_COLLAPSED = 34
const LINE_EXPANDED = 56
const LINE_MOBILE = 26

interface Props {
  lifecycle: SceneLifecycleState
  // Dwell-progress window where the annotation is fully visible. Before the
  // start it's fading in with the scene; between start and end it fades out
  // tracking the hemispheres closing.
  fadeOutStart: number
  fadeOutEnd: number
}

export function GoProAnnotation({ lifecycle, fadeOutStart, fadeOutEnd }: Props) {
  const { size } = useThree()
  const isMobile = size.width < 768
  const [hovered, setHovered] = useState(false)
  const isHoveredRef = useRef(false)
  const chatMode = useStore((s) => s.chatMode)

  const onOver = useCallback(() => {
    isHoveredRef.current = true
    setHovered(true)
  }, [])
  const onOut = useCallback(() => {
    isHoveredRef.current = false
    setHovered(false)
  }, [])

  // Visible ONLY while the hemispheres are open (dwellProgress < fadeOutEnd).
  // Once closed, annotation stays hidden through exiting/disposed so it doesn't
  // reappear late in the scene.
  const { phase, dwellProgress } = lifecycle
  let opacity = 0
  if (phase === 'entering') opacity = 1
  else if (phase === 'dwelling') {
    opacity = dwellProgress < fadeOutStart
      ? 1
      : Math.max(0, 1 - (dwellProgress - fadeOutStart) / (fadeOutEnd - fadeOutStart))
  }

  const visible = !(chatMode || phase === 'idle' || phase === 'disposed' || opacity <= 0.01)

  // When the annotation becomes hidden, the hitbox mesh unmounts and any
  // in-flight pointerOut is lost. Reset hover state so it doesn't persist
  // across the hidden→visible transition.
  useEffect(() => {
    if (!visible && isHoveredRef.current) {
      isHoveredRef.current = false
      setHovered(false)
    }
  }, [visible])

  // Each hidden → visible transition bumps a counter, used as a React `key` on
  // the animated element. Forces a fresh DOM node so the `holoReveal` CSS
  // animation replays every time the user reopens the hemispheres.
  const revealKey = useRef(0)
  const prevVisible = useRef(false)
  if (visible && !prevVisible.current) revealKey.current += 1
  prevVisible.current = visible

  if (!visible) return null

  const lineW = isMobile ? LINE_MOBILE : (hovered ? LINE_EXPANDED : LINE_COLLAPSED)

  return (
    <>
      {!isMobile && (
        <mesh
          position={POS}
          geometry={HITBOX_GEO}
          material={HITBOX_MAT}
          onPointerOver={onOver}
          onPointerOut={onOut}
        />
      )}
      <Html position={POS} style={{ pointerEvents: 'none' }}>
        {/* Outer layer carries the fade-out opacity (no animation). Inner layer
            is keyed on revealKey so the holoReveal animation replays fresh. */}
        <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none', opacity }}>
          <div
            key={revealKey.current}
            style={{
              position: 'relative',
              width: 0,
              height: 0,
              pointerEvents: 'none',
              animation: `holoReveal 0.9s ease-out 0s both`,
            }}
          >
            {/* Dot — pinned exactly at the 3D anchor, never moves */}
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
            {/* Vertical line — grows upward from the dot */}
            <div
              style={{
                position: 'absolute',
                left: '0px',
                bottom: '0px',
                width: '1px',
                height: `${lineW}px`,
                background: 'rgba(255,255,255,0.5)',
                transform: 'translateX(-50%)',
                transition: 'height 0.4s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
            {/* Label + detail stack — sits above the line */}
            <div
              style={{
                position: 'absolute',
                left: '0px',
                bottom: `${lineW + (isMobile ? 4 : 6)}px`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'none',
                transition: 'bottom 0.4s cubic-bezier(0.22,1,0.36,1)',
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
                GoPro MAX
              </span>
              {!isMobile && (
                <div
                  style={{
                    overflow: 'hidden',
                    maxHeight: hovered ? '60px' : '0px',
                    opacity: hovered ? 1 : 0,
                    transition: 'max-height 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
                    marginTop: hovered ? '4px' : '0px',
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
                      textAlign: 'center',
                    }}
                  >
                    {'Dual-fisheye 360\u00B0 camera\n5.6K spherical capture'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Html>
    </>
  )
}
