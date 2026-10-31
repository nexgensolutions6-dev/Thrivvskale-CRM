/**
 * Renders the six glass wallpapers (light and dark, two sizes, AVIF and WebP)
 * into public/wallpapers, and writes src/lib/glass/wallpapers.json with the
 * worst-case colour under each region of each wallpaper for the contrast test.
 * Run by hand after changing scripts/wallpapers/palettes.mjs: `node scripts/render-wallpapers.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { paintMesh } from './wallpapers/mesh.mjs'
import { WALLPAPERS } from './wallpapers/palettes.mjs'
import { sampleRegions } from './wallpapers/sample.mjs'

const OUT_DIR = fileURLToPath(new URL('../public/wallpapers/', import.meta.url))
const MANIFEST = fileURLToPath(new URL('../src/lib/glass/wallpapers.json', import.meta.url))

const SIZES = [
  { name: 'sm', width: 1280, height: 800 },
  { name: 'lg', width: 2560, height: 1600 },
]
const THEMES = ['light', 'dark']
// The manifest is measured on the small size; the large one is the same picture, only finer.
const SAMPLE_SIZE = 'sm'

async function writeImages(pixels, size, baseName, files) {
  const raw = { raw: { width: size.width, height: size.height, channels: 3 } }
  const stem = `${baseName}-${size.name}`
  await sharp(pixels, raw).avif({ quality: 55, effort: 4 }).toFile(`${OUT_DIR}${stem}.avif`)
  await sharp(pixels, raw).webp({ quality: 80 }).toFile(`${OUT_DIR}${stem}.webp`)
  files.push(`${stem}.avif`, `${stem}.webp`)
}

async function renderOne(wallpaper, theme, seed, files) {
  const design = wallpaper[theme]
  let regions = []
  for (const size of SIZES) {
    const pixels = paintMesh({ width: size.width, height: size.height, base: design.base, blobs: design.blobs, seed })
    if (size.name === SAMPLE_SIZE) regions = sampleRegions(pixels, size.width, size.height)
    await writeImages(pixels, size, `${wallpaper.id}-${theme}`, files)
  }
  return regions
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const files = []
  const manifest = []
  for (const [index, wallpaper] of WALLPAPERS.entries()) {
    const themes = {}
    for (const [themeIndex, theme] of THEMES.entries()) {
      try {
        themes[theme] = await renderOne(wallpaper, theme, 1000 + index * 10 + themeIndex, files)
      } catch (error) {
        throw new Error(`[render-wallpapers] ${wallpaper.id}/${theme} failed: ${error.message}`, { cause: error })
      }
    }
    manifest.push({ id: wallpaper.id, name: wallpaper.name, themes })
    console.log(`rendered ${wallpaper.id}`)
  }
  const json = { generatedBy: 'scripts/render-wallpapers.mjs', files, wallpapers: manifest }
  writeFileSync(MANIFEST, JSON.stringify(json, null, 2) + '\n')
  console.log(`wrote ${files.length} images and ${MANIFEST}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
