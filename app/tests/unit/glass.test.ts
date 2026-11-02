import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import wallpapers from '@/lib/glass/wallpapers.json'
import { compositeOver, contrastRatio, parseColor, toHex } from '@/lib/glass/contrast'
import { chooseGlassMode } from '@/lib/glass/mode'
import { readGlassTokens, type TokenMap } from '../support/glass-tokens'

const CALM = { prefersReducedTransparency: false, forcedColors: false }

describe('chooseGlassMode', () => {
  it('is full when nothing argues against it', () => {
    expect(chooseGlassMode(CALM)).toBe('full')
  })

  it('forced colors always means solid, even over a user override', () => {
    expect(chooseGlassMode({ ...CALM, forcedColors: true })).toBe('solid')
    expect(chooseGlassMode({ ...CALM, forcedColors: true, userOverride: 'full' })).toBe('solid')
  })

  it('the user override comes next and beats every automatic rule', () => {
    const struggling = { prefersReducedTransparency: true, forcedColors: false, deviceMemoryGb: 1, measuredFps: 10 }
    expect(chooseGlassMode({ ...struggling, userOverride: 'full' })).toBe('full')
    expect(chooseGlassMode({ ...CALM, userOverride: 'lite' })).toBe('lite')
  })

  it('reduced transparency means lite', () => {
    expect(chooseGlassMode({ ...CALM, prefersReducedTransparency: true })).toBe('lite')
  })

  it('device memory of 2 GB or less means lite, 4 GB does not', () => {
    expect(chooseGlassMode({ ...CALM, deviceMemoryGb: 2 })).toBe('lite')
    expect(chooseGlassMode({ ...CALM, deviceMemoryGb: 0.5 })).toBe('lite')
    expect(chooseGlassMode({ ...CALM, deviceMemoryGb: 4 })).toBe('full')
  })

  it('a measured frame rate under 40 means lite, 40 does not', () => {
    expect(chooseGlassMode({ ...CALM, measuredFps: 39 })).toBe('lite')
    expect(chooseGlassMode({ ...CALM, measuredFps: 40 })).toBe('full')
  })
})

describe('contrast helpers', () => {
  it('black on white is 21:1 and a colour on itself is 1:1', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 2)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })

  it('parses hex and rgb() colours', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
  })

  it('names the module when a colour cannot be read', () => {
    expect(() => parseColor('banana')).toThrow(/\[glass\/contrast\] parseColor/)
  })

  it('refuses a see-through colour instead of guessing what is behind it', () => {
    expect(() => contrastRatio('rgba(0,0,0,0.5)', '#fff')).toThrow(/\[glass\/contrast\] contrastRatio/)
  })

  it('composites a tint over a background', () => {
    const out = compositeOver({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0 })
    expect(out.r).toBeCloseTo(127.5, 5)
    expect(out.g).toBeCloseTo(127.5, 5)
    expect(out.b).toBeCloseTo(127.5, 5)
  })
})

describe('wallpaper manifest', () => {
  it('lists six wallpapers with nine sampled regions per theme', () => {
    expect(wallpapers.wallpapers).toHaveLength(6)
    for (const wallpaper of wallpapers.wallpapers) {
      expect(wallpaper.themes.light).toHaveLength(9)
      expect(wallpaper.themes.dark).toHaveLength(9)
    }
  })

  it('has every rendered image on disk', () => {
    const missing: string[] = []
    for (const file of wallpapers.files) {
      const path = fileURLToPath(new URL(`../../public/wallpapers/${file}`, import.meta.url))
      if (!existsSync(path)) missing.push(file)
    }
    expect(missing).toEqual([])
    expect(wallpapers.files.length).toBe(6 * 2 * 2 * 2) // wallpapers x themes x sizes x formats
  })
})

const tokens = readGlassTokens()
const BODY_TEXT = ['--glass-text', '--glass-text-secondary']
const LARGE_TEXT = ['--glass-text-large', '--glass-text-muted-large']
const SURFACES = [
  { name: 'L3', fill: '--glass-l3-tint' },
  { name: 'L2', fill: '--glass-l2-tint' },
  { name: 'L3 lite', fill: '--glass-l3-tint-lite' },
  { name: 'L2 lite', fill: '--glass-l2-tint-lite' },
] as const
const SOLIDS = [
  { name: 'L3 solid', fill: '--glass-l3-solid' },
  { name: 'L2 solid', fill: '--glass-l2-solid' },
  { name: 'list row', fill: '--glass-row-fill' },
] as const

function token(map: TokenMap, theme: string, name: string): string {
  const value = map[name]
  if (!value) throw new Error(`[glass.test] token ${name} is missing from the ${theme} tokens in glass.css`)
  return value
}

/** The lowest contrast of `textColour` over a tint laid on both extreme samples of one region. */
function worstRatio(textColour: string, tint: string, region: { darkest: string; lightest: string }): number {
  const fill = parseColor(tint)
  return Math.min(
    ...[region.darkest, region.lightest].map((sample) => {
      const behind = compositeOver(fill, parseColor(sample))
      return contrastRatio(textColour, toHex(behind))
    }),
  )
}

describe('text contrast on every surface over every wallpaper region', () => {
  for (const theme of ['light', 'dark'] as const) {
    const map = tokens[theme]
    for (const wallpaper of wallpapers.wallpapers) {
      for (const surface of SURFACES) {
        it(`${theme} / ${wallpaper.id} / ${surface.name}: body >= 4.5, large >= 3`, () => {
          const tint = token(map, theme, surface.fill)
          for (const region of wallpaper.themes[theme]) {
            for (const name of BODY_TEXT) {
              const ratio = worstRatio(token(map, theme, name), tint, region)
              expect(ratio, `${name} on ${region.region}`).toBeGreaterThanOrEqual(4.5)
            }
            for (const name of LARGE_TEXT) {
              const ratio = worstRatio(token(map, theme, name), tint, region)
              expect(ratio, `${name} on ${region.region}`).toBeGreaterThanOrEqual(3)
            }
          }
        })
      }
    }
    for (const surface of SOLIDS) {
      it(`${theme} / ${surface.name}: body >= 4.5, large >= 3`, () => {
        const fill = token(map, theme, surface.fill)
        for (const name of BODY_TEXT) expect(contrastRatio(token(map, theme, name), fill)).toBeGreaterThanOrEqual(4.5)
        for (const name of LARGE_TEXT) expect(contrastRatio(token(map, theme, name), fill)).toBeGreaterThanOrEqual(3)
      })
    }
  }
})
