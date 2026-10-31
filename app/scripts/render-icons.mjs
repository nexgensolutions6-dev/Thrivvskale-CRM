/**
 * Draws the app icons (no downloaded images) into public/: rounded 192 and 512
 * icons, a full-bleed maskable 512, and the 180px Apple touch icon. The mark is
 * a bold "T" over a rising line on a violet gradient. Run by hand after changing
 * the artwork: `node scripts/render-icons.mjs`. Uses sharp, like render-wallpapers.mjs.
 */
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url))
const ICON_DIR = `${PUBLIC_DIR}icons/`

/** Artwork is drawn on a 512 grid. `inset` shrinks the mark toward the centre (maskable safe zone). */
function iconSvg({ rounded, inset }) {
  const radius = rounded ? 112 : 0
  const scale = 1 - inset
  const offset = (512 * (1 - scale)) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c6cf0"/>
      <stop offset="1" stop-color="#3b3fb8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})"
     fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
    <path d="M136 140h240M256 140v196" stroke-width="56"/>
    <path d="M140 424l76-30 56 20 100-56" stroke-width="22" stroke-opacity="0.6"/>
  </g>
</svg>`
}

const ICONS = [
  { file: `${ICON_DIR}icon-192.png`, size: 192, svg: iconSvg({ rounded: true, inset: 0 }) },
  { file: `${ICON_DIR}icon-512.png`, size: 512, svg: iconSvg({ rounded: true, inset: 0 }) },
  // Maskable: the OS crops to its own shape, so fill the square and keep the mark inside the central 80%.
  { file: `${ICON_DIR}icon-maskable-512.png`, size: 512, svg: iconSvg({ rounded: false, inset: 0.2 }) },
  // iOS rounds the corners itself and dislikes transparency.
  { file: `${PUBLIC_DIR}apple-touch-icon.png`, size: 180, svg: iconSvg({ rounded: false, inset: 0.08 }) },
]

async function main() {
  mkdirSync(ICON_DIR, { recursive: true })
  for (const icon of ICONS) {
    await sharp(Buffer.from(icon.svg)).resize(icon.size, icon.size).png().toFile(icon.file)
    console.log(`[render-icons] wrote ${icon.file}`)
  }
}

main().catch((error) => {
  console.error('[render-icons] drawing the icons failed:', error)
  process.exit(1)
})
