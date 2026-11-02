/**
 * Menu bar legibility: the text token MenuBar uses must reach 4.5:1 on its chip
 * fill, composited over every wallpaper worst-case sample (light and dark). Raw L1
 * tint failed this in dark (4.3:1 on bright regions), hence the opaque chips.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import wallpapers from '@/lib/glass/wallpapers.json'
import { compositeOver, contrastRatio, parseColor, toHex } from '@/lib/glass/contrast'
import { MENU_BAR_CHIP_FILL_TOKEN, MENU_BAR_TEXT_TOKEN } from '@/lib/shell/menu-bar-text'
import { readGlassTokens, type TokenMap } from '../support/glass-tokens'

const tokens = readGlassTokens()
const MENU_BAR = fileURLToPath(new URL('../../src/components/shell/MenuBar.tsx', import.meta.url))

function need(map: TokenMap, theme: string, name: string): string {
  const value = map[name]
  if (!value) throw new Error(`[menu-bar-contrast.test] token ${name} missing from the ${theme} tokens in glass.css`)
  return value
}

describe('menu bar text on its chip fill, over every wallpaper worst-case sample', () => {
  for (const theme of ['light', 'dark'] as const) {
    const map = tokens[theme]
    const text = need(map, theme, MENU_BAR_TEXT_TOKEN)
    const chip = parseColor(need(map, theme, MENU_BAR_CHIP_FILL_TOKEN))
    for (const wallpaper of wallpapers.wallpapers) {
      it(`${theme} / ${wallpaper.id}: ${MENU_BAR_TEXT_TOKEN} >= 4.5 on ${MENU_BAR_CHIP_FILL_TOKEN}`, () => {
        for (const region of wallpaper.themes[theme]) {
          for (const sample of [region.darkest, region.lightest]) {
            const behind = toHex(compositeOver(chip, parseColor(sample)))
            expect(contrastRatio(text, behind), `${region.region} (${sample})`).toBeGreaterThanOrEqual(4.5)
          }
        }
      })
    }
  }

  it('the chip fill is opaque, so the wallpaper cannot change the contrast', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(parseColor(need(tokens[theme], theme, MENU_BAR_CHIP_FILL_TOKEN)).a).toBe(1)
    }
  })

  it('MenuBar.tsx uses exactly those tokens and never the secondary text token', () => {
    const source = readFileSync(MENU_BAR, 'utf8')
    expect(source).toContain(`bg-(${MENU_BAR_CHIP_FILL_TOKEN})`)
    expect(source).toContain(`text-(${MENU_BAR_TEXT_TOKEN})`)
    expect(source).not.toContain('--glass-text-secondary')
  })
})
