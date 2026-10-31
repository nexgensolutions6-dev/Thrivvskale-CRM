/**
 * Finds the worst-case colours under each part of a wallpaper. The picture is
 * cut into a 3x3 grid; inside each region the picture is averaged in small
 * blocks (roughly what a blurred panel sees) and the darkest and lightest block
 * are kept. Dark text is judged against the darkest, light text against the
 * lightest. Used by scripts/render-wallpapers.mjs to write wallpapers.json.
 */

const GRID = 3
const BLOCK_PX = 32
const REGION_NAMES = [
  ['top-left', 'top-centre', 'top-right'],
  ['middle-left', 'centre', 'middle-right'],
  ['bottom-left', 'bottom-centre', 'bottom-right'],
]

// Same formula as relativeLuminance in src/lib/glass/contrast.ts (this file is plain .mjs and cannot import it).
function channelLuminance(value) {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance([r, g, b]) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

function toHex([r, g, b]) {
  return '#' + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')
}

/** Mean colour of the block from (x0, y0) up to (x1, y1), in an image `width` pixels wide. */
function blockMean(rgb, width, x0, y0, x1, y1) {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 3
      r += rgb[i]
      g += rgb[i + 1]
      b += rgb[i + 2]
      count++
    }
  }
  return [r / count, g / count, b / count]
}

/** Returns nine { region, darkest, lightest } entries, left to right, top to bottom. */
export function sampleRegions(rgb, width, height) {
  const regions = []
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const xStart = Math.floor((col * width) / GRID)
      const xEnd = Math.floor(((col + 1) * width) / GRID)
      const yStart = Math.floor((row * height) / GRID)
      const yEnd = Math.floor(((row + 1) * height) / GRID)
      let darkest = null
      let lightest = null
      for (let y = yStart; y < yEnd; y += BLOCK_PX) {
        for (let x = xStart; x < xEnd; x += BLOCK_PX) {
          const mean = blockMean(rgb, width, x, y, Math.min(x + BLOCK_PX, xEnd), Math.min(y + BLOCK_PX, yEnd))
          if (!darkest || luminance(mean) < luminance(darkest)) darkest = mean
          if (!lightest || luminance(mean) > luminance(lightest)) lightest = mean
        }
      }
      regions.push({ region: REGION_NAMES[row][col], darkest: toHex(darkest), lightest: toHex(lightest) })
    }
  }
  return regions
}
