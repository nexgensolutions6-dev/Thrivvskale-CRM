/**
 * Paints a mesh gradient into raw RGB bytes: every pixel is a weighted mix of
 * the base colour and the blobs, each blob fading out like a soft bell curve.
 * A tiny seeded noise (about one colour step) is added so smooth gradients do
 * not show banding after compression. Used by scripts/render-wallpapers.mjs.
 */

const BASE_WEIGHT = 0.02

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Small deterministic random numbers, so re-running the script gives identical files. */
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Returns a Buffer of width*height*3 bytes (RGB, no alpha). */
export function paintMesh({ width, height, base, blobs, seed }) {
  const random = seededRandom(seed)
  const baseRgb = hexToRgb(base)
  const parts = blobs.map((b) => ({ ...b, rgb: hexToRgb(b.color) }))
  const out = Buffer.alloc(width * height * 3)
  const aspect = width / height

  for (let py = 0; py < height; py++) {
    const v = py / height
    for (let px = 0; px < width; px++) {
      const u = px / width
      let total = BASE_WEIGHT
      let r = baseRgb[0] * BASE_WEIGHT
      let g = baseRgb[1] * BASE_WEIGHT
      let b = baseRgb[2] * BASE_WEIGHT
      for (const part of parts) {
        const dx = u - part.x
        const dy = (v - part.y) / aspect
        const weight = Math.exp(-(dx * dx + dy * dy) / (2 * part.spread * part.spread))
        total += weight
        r += part.rgb[0] * weight
        g += part.rgb[1] * weight
        b += part.rgb[2] * weight
      }
      const i = (py * width + px) * 3
      out[i] = clampByte(r / total + (random() - 0.5) * 1.5)
      out[i + 1] = clampByte(g / total + (random() - 0.5) * 1.5)
      out[i + 2] = clampByte(b / total + (random() - 0.5) * 1.5)
    }
  }
  return out
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}
