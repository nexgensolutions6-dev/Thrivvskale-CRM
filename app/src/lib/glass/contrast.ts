/**
 * Colour maths for the legibility check: parse a colour, lay a translucent tint
 * over a background, and compute the WCAG contrast ratio. Pure functions; called
 * by tests/unit/glass.test.ts (the legibility check).
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Rgba extends Rgb {
  a: number
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const FUNCTIONAL = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i

/** Reads '#rgb', '#rrggbb', 'rgb(r, g, b)' or 'rgba(r, g, b, a)'. Throws on anything else. */
export function parseColor(text: string): Rgba {
  const value = text.trim()
  const hex = HEX.exec(value)
  if (hex) return parseHex(hex[1])
  const fn = FUNCTIONAL.exec(value)
  if (fn) return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), a: fn[4] === undefined ? 1 : Number(fn[4]) }
  throw new Error(`[glass/contrast] parseColor failed: cannot read colour "${text}"`)
}

function parseHex(digits: string): Rgba {
  const full = digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 1,
  }
}

/** '#rrggbb' for a colour, rounding each channel. */
export function toHex(color: Rgb): string {
  const part = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`
}

/** What the eye sees when `tint` (with its alpha) is laid over the opaque `bg`. */
export function compositeOver(tint: Rgba, bg: Rgb): Rgb {
  return {
    r: tint.r * tint.a + bg.r * (1 - tint.a),
    g: tint.g * tint.a + bg.g * (1 - tint.a),
    b: tint.b * tint.a + bg.b * (1 - tint.a),
  }
}

function channelLuminance(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(color: Rgb): number {
  return 0.2126 * channelLuminance(color.r) + 0.7152 * channelLuminance(color.g) + 0.0722 * channelLuminance(color.b)
}

/** WCAG contrast ratio between two opaque colours, from 1 to 21. */
export function contrastRatio(fg: string, bg: string): number {
  const front = parseColor(fg)
  const back = parseColor(bg)
  if (front.a < 1 || back.a < 1) {
    throw new Error(`[glass/contrast] contrastRatio failed: "${fg}" on "${bg}" is see-through; compositeOver first`)
  }
  const a = relativeLuminance(front)
  const b = relativeLuminance(back)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
