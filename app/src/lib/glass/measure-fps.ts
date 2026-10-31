/**
 * Measures how many frames per second the browser really draws, over a short
 * window. Resolves to undefined when the tab is hidden (browsers pause frames
 * there, which would look like a slow device). Called by GlassModeSync.
 */

/** Counts animation frames for `durationMs` and returns frames per second. */
export function measureFps(durationMs: number): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (document.hidden) {
      resolve(undefined)
      return
    }
    const startedAt = performance.now()
    let frames = 0

    function onFrame(now: number) {
      if (document.hidden) {
        resolve(undefined)
        return
      }
      frames++
      const elapsed = now - startedAt
      if (elapsed >= durationMs) {
        resolve((frames * 1000) / elapsed)
        return
      }
      requestAnimationFrame(onFrame)
    }
    requestAnimationFrame(onFrame)
  })
}
