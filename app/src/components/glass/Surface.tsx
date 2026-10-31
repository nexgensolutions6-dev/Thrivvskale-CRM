'use client'
/**
 * A glass panel. L1 = chrome (menu bar, dock), L2 = cards and panels, L3 = focus
 * (call card, sheets, forms: anywhere text must be read). Styling lives in
 * src/styles/glass.css; the lite and solid looks switch on <html data-glass>.
 * Used by every screen; the shell (Task 13) places the L1 pieces.
 */
import type { HTMLAttributes, PointerEvent } from 'react'
import { trackPointer } from './pointer-highlight'

export type SurfaceLevel = 'L1' | 'L2' | 'L3'

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  level: SurfaceLevel
}

const LEVEL_CLASS: Record<SurfaceLevel, string> = {
  L1: 'glass glass-l1',
  L2: 'glass glass-l2',
  L3: 'glass glass-l3',
}

export function Surface({ level, className, onPointerMove, children, ...rest }: SurfaceProps) {
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    trackPointer(event)
    onPointerMove?.(event)
  }

  const classes = className ? `${LEVEL_CLASS[level]} ${className}` : LEVEL_CLASS[level]
  return (
    <div {...rest} className={classes} data-glass-level={level} onPointerMove={handlePointerMove}>
      {children}
    </div>
  )
}
