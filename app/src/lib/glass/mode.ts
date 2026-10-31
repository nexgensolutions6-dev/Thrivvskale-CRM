/**
 * Decides how much glass to draw: 'full' (live blur), 'lite' (translucent solid,
 * no blur) or 'solid' (opaque). Pure function; called by GlassModeSync with what
 * the browser reports, and by Task 13's Settings screen for the user override.
 */

export type GlassMode = 'full' | 'lite' | 'solid'

export interface GlassEnv {
  /** `navigator.deviceMemory`, in GB. Missing on browsers that hide it. */
  deviceMemoryGb?: number
  prefersReducedTransparency: boolean
  forcedColors: boolean
  /** Frames per second measured on this device, if a measurement has finished. */
  measuredFps?: number
  /** The choice made in Settings. Leave out for "automatic". */
  userOverride?: 'full' | 'lite'
}

export const LOW_MEMORY_GB = 2
export const MIN_SMOOTH_FPS = 40

/**
 * Rules, first match wins:
 *  1. forced colors -> solid (nothing may override the operating system)
 *  2. user override -> that choice
 *  3. reduced transparency -> lite
 *  4. device memory <= 2 GB -> lite
 *  5. measured fps < 40 -> lite
 *  6. otherwise full
 */
export function chooseGlassMode(env: GlassEnv): GlassMode {
  if (env.forcedColors) return 'solid'
  if (env.userOverride) return env.userOverride
  if (env.prefersReducedTransparency) return 'lite'
  if (env.deviceMemoryGb !== undefined && env.deviceMemoryGb <= LOW_MEMORY_GB) return 'lite'
  if (env.measuredFps !== undefined && env.measuredFps < MIN_SMOOTH_FPS) return 'lite'
  return 'full'
}
