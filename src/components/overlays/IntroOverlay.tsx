'use client'

import { useStore } from '@/store/useStore'

// Intro text fades out as the pullback finishes
const FADE_OUT_START = 0.12
const FADE_OUT_END = 0.15

export function IntroOverlay() {
  const scrollT = useStore((s) => s.scrollT)
  const gpuReady = useStore((s) => s.gpuReady)
  const chatMode = useStore((s) => s.chatMode)

  if (!gpuReady || scrollT >= FADE_OUT_END || chatMode) return null

  const opacity =
    scrollT <= FADE_OUT_START
      ? 1
      : 1 - (scrollT - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START)

  // Animate the BOUSSOURA mask as the camera pulls back (scrollT 0 → 0.12).
  // Uses smootherstep to match CameraRig's S-0 pullback easing (PATH_SEGMENTS[0]).
  // At scrollT=0 (close-up): most letters hidden — gradient cuts in early.
  // At scrollT=0.12 (full pullback): all letters revealed.
  const rawProg = Math.min(scrollT / 0.12, 1)
  const t = rawProg * rawProg * rawProg * (rawProg * (rawProg * 6 - 15) + 10) // smootherstep
  const solidEnd = (55 + t * 48).toFixed(1)  // 55% → 103%
  const fadeEnd  = (80 + t * 43).toFixed(1)  // 80% → 123%
  const boussouraMask = `linear-gradient(to right, black ${solidEnd}%, transparent ${fadeEnd}%)`

  return (
    <>
      <style>{`
        .intro-outer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 8;
          display: flex;
          align-items: flex-end;
        }
        .intro-text-block {
          padding-left: clamp(24px, 5vw, 80px);
          padding-bottom: clamp(32px, 5vh, 64px);
          max-width: 52vw;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .intro-heading {
          font-family: var(--font-bebas);
          font-size: clamp(52px, 10vw, 200px);
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.92);
          margin: 0;
          line-height: 0.92;
        }
        /* display:block so it occupies its own line; mask is applied via inline style */
        .intro-boussoura {
          display: block;
        }
        .intro-sub {
          font-family: var(--font-space-mono, monospace);
          font-size: clamp(11px, 1.1vw, 14px);
          letter-spacing: 0.3em;
          color: rgba(255,255,255,0.42);
          margin: 0;
          text-transform: uppercase;
        }
        .intro-scroll-cue {
          position: absolute;
          bottom: 5%;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        /* ── Mobile: text block at the bottom center ── */
        @media (max-width: 767px) {
          .intro-outer {
            align-items: flex-end;
          }
          .intro-text-block {
            padding-left: 0;
            padding-bottom: clamp(72px, 10vh, 120px);
            max-width: 100vw;
            width: 100%;
            align-items: center;
            text-align: center;
          }
          .intro-heading {
            font-size: clamp(52px, 14vw, 80px);
          }
          /* No mask on mobile — text is at the bottom, not overlapping the head */
          .intro-boussoura {
            -webkit-mask-image: none !important;
            mask-image: none !important;
          }
        }
      `}</style>

      <div className="intro-outer" style={{ opacity }}>
        {/* Name + tagline */}
        <div className="intro-text-block">
          <h1 className="intro-heading">
            RIAD
            <br />
            <span
              className="intro-boussoura"
              style={{ WebkitMaskImage: boussouraMask, maskImage: boussouraMask }}
            >BOUSSOURA</span>
          </h1>
          <p className="intro-sub">Scroll to discover my journey</p>
        </div>

        {/* Scroll cue */}
        <div className="intro-scroll-cue">
          <span
            style={{
              fontFamily: 'var(--font-space-mono, monospace)',
              fontSize: '9px',
              letterSpacing: '0.28em',
              color: 'rgba(255,255,255,0.25)',
              textTransform: 'uppercase',
            }}
          >
            SCROLL
          </span>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
            <line x1="6" y1="0" x2="6" y2="13" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
            <polyline
              points="2,9 6,15 10,9"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1"
            />
          </svg>
        </div>
      </div>
    </>
  )
}
