import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closePalette,
  getPaletteState,
  openPalette,
  resetPaletteForTests,
  subscribePalette,
  togglePalette,
} from '@/lib/shell/palette-store'

beforeEach(() => resetPaletteForTests())

describe('palette store', () => {
  it('starts closed with an empty query', () => {
    expect(getPaletteState()).toEqual({ open: false, query: '' })
  })

  it('opens with an optional starting query and closes again', () => {
    openPalette('add')
    expect(getPaletteState()).toEqual({ open: true, query: 'add' })
    closePalette()
    expect(getPaletteState().open).toBe(false)
  })

  it('toggles', () => {
    togglePalette()
    expect(getPaletteState().open).toBe(true)
    togglePalette()
    expect(getPaletteState().open).toBe(false)
  })

  it('notifies subscribers only when something changed', () => {
    const listener = vi.fn()
    const stop = subscribePalette(listener)
    closePalette() // already closed: no change
    expect(listener).not.toHaveBeenCalled()
    openPalette()
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    closePalette()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('returns the same object until the state changes', () => {
    const first = getPaletteState()
    expect(getPaletteState()).toBe(first)
    openPalette()
    expect(getPaletteState()).not.toBe(first)
  })
})
