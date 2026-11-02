/**
 * The six wallpaper designs: a base colour plus coloured "blobs" per theme.
 * Light blobs stay bright (dark text must read on them), dark blobs stay deep
 * (light text must read on them). Each design has 3+ hues so blur has colour to
 * pick up. Used by scripts/render-wallpapers.mjs. Tune colours here; the contrast
 * test in tests/unit/glass.test.ts says whether a change is still legible.
 */

/** A blob: centre (x, y as 0..1 of the image), spread (fraction of image width), colour. */
const blob = (x, y, spread, color) => ({ x, y, spread, color })

export const WALLPAPERS = [
  {
    id: 'aurora',
    name: 'Aurora',
    light: {
      base: '#e9ddff',
      blobs: [blob(0.15, 0.2, 0.34, '#a78bfa'), blob(0.85, 0.25, 0.3, '#5eead4'), blob(0.55, 0.9, 0.36, '#f9a8d4')],
    },
    dark: {
      base: '#0a0820',
      blobs: [blob(0.15, 0.2, 0.34, '#4a22c9'), blob(0.85, 0.25, 0.3, '#0e7f8a'), blob(0.55, 0.9, 0.36, '#9c2a8f')],
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    light: {
      base: '#ffe8d6',
      blobs: [blob(0.8, 0.15, 0.32, '#fdba74'), blob(0.2, 0.5, 0.34, '#f472b6'), blob(0.7, 0.9, 0.36, '#a5b4fc')],
    },
    dark: {
      base: '#14070f',
      blobs: [blob(0.8, 0.15, 0.32, '#a8400f'), blob(0.2, 0.5, 0.34, '#a3194f'), blob(0.7, 0.9, 0.36, '#3b3799')],
    },
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    light: {
      base: '#dcf7f5',
      blobs: [blob(0.2, 0.15, 0.34, '#67e8f9'), blob(0.85, 0.55, 0.32, '#93c5fd'), blob(0.3, 0.9, 0.34, '#86efac')],
    },
    dark: {
      base: '#041418',
      blobs: [blob(0.2, 0.15, 0.34, '#0a6a80'), blob(0.85, 0.55, 0.32, '#2447a8'), blob(0.3, 0.9, 0.34, '#1b7a45')],
    },
  },
  {
    id: 'orchid',
    name: 'Orchid',
    light: {
      base: '#fbe3fb',
      blobs: [blob(0.25, 0.25, 0.34, '#e879f9'), blob(0.85, 0.2, 0.3, '#fda4af'), blob(0.6, 0.85, 0.36, '#7dd3fc')],
    },
    dark: {
      base: '#12061a',
      blobs: [blob(0.25, 0.25, 0.34, '#8f23a3'), blob(0.85, 0.2, 0.3, '#a8203f'), blob(0.6, 0.85, 0.36, '#1f4fae')],
    },
  },
  {
    id: 'citrus',
    name: 'Citrus',
    light: {
      base: '#fff7cc',
      blobs: [blob(0.15, 0.2, 0.32, '#fde047'), blob(0.8, 0.35, 0.32, '#bef264'), blob(0.4, 0.95, 0.36, '#5eead4')],
    },
    dark: {
      base: '#0d0f05',
      blobs: [blob(0.15, 0.2, 0.32, '#8a5a0c'), blob(0.8, 0.35, 0.32, '#47731a'), blob(0.4, 0.95, 0.36, '#117a6f')],
    },
  },
  {
    id: 'glacier',
    name: 'Glacier',
    light: {
      base: '#e8f3ff',
      blobs: [blob(0.7, 0.15, 0.34, '#bae6fd'), blob(0.15, 0.6, 0.32, '#c4b5fd'), blob(0.75, 0.9, 0.34, '#99f6e4')],
    },
    dark: {
      base: '#050b16',
      blobs: [blob(0.7, 0.15, 0.34, '#10608f'), blob(0.15, 0.6, 0.32, '#5326b3'), blob(0.75, 0.9, 0.34, '#12766b')],
    },
  },
]
