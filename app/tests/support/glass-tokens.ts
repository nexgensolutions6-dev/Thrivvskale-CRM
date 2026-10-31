/**
 * Reads the design tokens out of src/styles/glass.css so tests check the values
 * the browser really uses. Light tokens are the first `:root` block; dark tokens
 * are the `:root` block inside `@media (prefers-color-scheme: dark)`.
 * Called by tests/unit/glass.test.ts.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export type TokenMap = Record<string, string>
export interface GlassTokens {
  light: TokenMap
  dark: TokenMap
}

const GLASS_CSS = fileURLToPath(new URL('../../src/styles/glass.css', import.meta.url))
const DARK_MEDIA = '@media (prefers-color-scheme: dark)'

/** Returns the text between the `{` at `openIndex` and its matching `}`. */
function blockBody(css: string, openIndex: number): string {
  let depth = 0
  for (let i = openIndex; i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    if (depth === 0) return css.slice(openIndex + 1, i)
  }
  throw new Error(`[glass-tokens] unbalanced braces after index ${openIndex} in ${GLASS_CSS}`)
}

/** Collects every `--name: value;` declaration of the first `:root { ... }` block in `css`. */
function rootTokens(css: string, where: string): TokenMap {
  const start = css.indexOf(':root')
  if (start === -1) throw new Error(`[glass-tokens] no :root block found in ${where}`)
  const body = blockBody(css, css.indexOf('{', start))
  const tokens: TokenMap = {}
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[match[1]] = match[2].trim()
  return tokens
}

export function readGlassTokens(): GlassTokens {
  const css = readFileSync(GLASS_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const mediaAt = css.indexOf(DARK_MEDIA)
  if (mediaAt === -1) throw new Error(`[glass-tokens] "${DARK_MEDIA}" block missing in ${GLASS_CSS}`)
  const darkBody = blockBody(css, css.indexOf('{', mediaAt))
  return {
    light: rootTokens(css.slice(0, mediaAt), 'the light tokens'),
    dark: rootTokens(darkBody, 'the dark media block'),
  }
}
