/**
 * Builds the inline style that puts a rendered wallpaper behind a page: the
 * `.glass-wallpaper` class (glass.css) picks the light or dark image. Each theme
 * offers AVIF and WebP at 1x (1280px) and 2x (2560px). Called by pages and the shell.
 */
import type { CSSProperties } from 'react'
import manifest from './wallpapers.json'

export type WallpaperId = (typeof manifest.wallpapers)[number]['id']

function imageSet(id: string, theme: 'light' | 'dark'): string {
  const url = (size: 'sm' | 'lg', format: 'avif' | 'webp') => `/wallpapers/${id}-${theme}-${size}.${format}`
  return [
    `url(${url('sm', 'avif')}) type("image/avif") 1x`,
    `url(${url('sm', 'webp')}) type("image/webp") 1x`,
    `url(${url('lg', 'avif')}) type("image/avif") 2x`,
    `url(${url('lg', 'webp')}) type("image/webp") 2x`,
  ].join(', ')
}

export function wallpaperStyle(id: WallpaperId): CSSProperties {
  if (!manifest.wallpapers.some((wallpaper) => wallpaper.id === id)) {
    throw new Error(`[glass/wallpaper-style] wallpaperStyle failed: unknown wallpaper "${id}"`)
  }
  return {
    '--glass-wallpaper-light': `image-set(${imageSet(id, 'light')})`,
    '--glass-wallpaper-dark': `image-set(${imageSet(id, 'dark')})`,
  } as CSSProperties
}
