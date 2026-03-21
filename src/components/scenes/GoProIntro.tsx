'use client'

import { useStore } from '@/store/useStore'

// ─── Timing (scrollT) ──────────────────────────────────────────────────────
// Text appears BEFORE the GoPro 3D objects to build narrative context.
// GoPro enterStart=0.226, enterEnd=0.235. We lead the text by ~0.04.
const FADE_IN_START = 0.185   // camera swinging toward GoPro zone
const FADE_IN_END   = 0.215   // fully readable before 3D objects appear
const FADE_OUT_START = 0.248  // hemispheres have been open long enough
const FADE_OUT_END   = 0.268  // text gone before close animation

export function GoProIntro() {
  const scrollT = useStore((s) => s.scrollT)
  const chatMode = useStore((s) => s.chatMode)

  if (scrollT < FADE_IN_START || scrollT > FADE_OUT_END || chatMode) return null

  let opacity = 1
  if (scrollT < FADE_IN_END) {
    opacity = (scrollT - FADE_IN_START) / (FADE_IN_END - FADE_IN_START)
  } else if (scrollT > FADE_OUT_START) {
    opacity = 1 - (scrollT - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START)
  }

  return (
    <>
      <style>{`
        .gopro-intro-outer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 8;
          display: flex;
          align-items: center;
        }
        .gopro-intro-block {
          padding-left: clamp(24px, 5vw, 80px);
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .gopro-intro-tag {
          font-family: var(--font-space-mono, monospace);
          font-size: 10px;
          letter-spacing: 0.32em;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
          margin: 0;
        }
        .gopro-intro-title {
          font-family: var(--font-bebas, sans-serif);
          font-size: clamp(38px, 6vw, 72px);
          letter-spacing: 0.03em;
          color: rgba(255,255,255,0.88);
          margin: 0;
          line-height: 0.95;
        }
        .gopro-intro-rule {
          width: 40px;
          height: 1px;
          background: rgba(255,255,255,0.18);
          border: none;
          margin: 2px 0;
        }
        .gopro-intro-desc {
          font-family: var(--font-dm-sans, sans-serif);
          font-size: clamp(13px, 1.15vw, 15px);
          line-height: 1.65;
          color: rgba(255,255,255,0.48);
          margin: 0;
        }

        /* Mobile: center the block, slightly lower */
        @media (max-width: 767px) {
          .gopro-intro-outer {
            align-items: flex-end;
            padding-bottom: clamp(80px, 12vh, 140px);
          }
          .gopro-intro-block {
            padding-left: 0;
            max-width: 90vw;
            width: 100%;
            align-items: center;
            text-align: center;
            margin: 0 auto;
          }
          .gopro-intro-rule {
            margin: 2px auto;
          }
        }
      `}</style>

      <div className="gopro-intro-outer" style={{ opacity }}>
        <div className="gopro-intro-block">
          <p className="gopro-intro-tag">Project 01 // GoPro MAX</p>
          <h2 className="gopro-intro-title">
            360° IMAGE
            <br />
            STITCHING
          </h2>
          <hr className="gopro-intro-rule" />
          <p className="gopro-intro-desc">
            Two fisheye lenses capture overlapping hemispheres
            of the world. Aligning and blending them into a
            seamless equirectangular panorama is the core
            challenge of 360 photography.
          </p>
        </div>
      </div>
    </>
  )
}
