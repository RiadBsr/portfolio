/**
 * Easing functions for snappy, organic animations.
 * All functions map [0,1] → [0,1].
 */

/** Classic smoothstep — ease-in-out with zero velocity at endpoints. */
export function smoothstep(t: number): number {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}

/** Smootherstep (Perlin) — second-order smooth at endpoints, snappier midrange. */
export function smootherstep(t: number): number {
  t = Math.max(0, Math.min(1, t))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Parametric ease-in-out — adjustable snappiness.
 * k=2 ≈ smoothstep, k=3 ≈ snappy TikTok feel, k>4 ≈ near-snap.
 * Symmetric sigmoid shape with zero velocity at endpoints.
 */
export function easeInOut(t: number, k = 3): number {
  t = Math.max(0, Math.min(1, t))
  return t ** k / (t ** k + (1 - t) ** k)
}

/** Ease-out — fast start, gentle landing. */
export function easeOut(t: number, k = 3): number {
  t = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - t, k)
}

/** Ease-in — gentle start, fast end. */
export function easeIn(t: number, k = 3): number {
  t = Math.max(0, Math.min(1, t))
  return Math.pow(t, k)
}
