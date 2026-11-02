import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GLASS_OVERRIDE_KEY,
  parseGlassOverride,
  readGlassOverride,
  resetGlassOverrideForTests,
  writeGlassOverride,
} from '@/lib/shell/glass-override'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  }
}

const brokenStorage = {
  getItem: (): string | null => {
    throw new Error('blocked')
  },
  setItem: (): void => {
    throw new Error('blocked')
  },
  removeItem: (): void => {
    throw new Error('blocked')
  },
}

beforeEach(() => resetGlassOverrideForTests())
afterEach(() => vi.restoreAllMocks())

describe('parseGlassOverride', () => {
  it.each([
    ['lite', 'lite'],
    ['full', 'full'],
  ] as const)('accepts %s', (raw, expected) => {
    expect(parseGlassOverride(raw)).toBe(expected)
  })

  it.each([null, '', 'solid', 'LITE', 'auto', '{}'])('treats %j as automatic', (raw) => {
    expect(parseGlassOverride(raw)).toBeUndefined()
  })
})

describe('readGlassOverride / writeGlassOverride', () => {
  it('reads what was written', () => {
    const storage = fakeStorage()
    expect(readGlassOverride(storage)).toBeUndefined()
    writeGlassOverride('lite', storage)
    expect(storage.data.get(GLASS_OVERRIDE_KEY)).toBe('lite')
    expect(readGlassOverride(storage)).toBe('lite')
  })

  it('writing undefined removes the choice (back to automatic)', () => {
    const storage = fakeStorage({ [GLASS_OVERRIDE_KEY]: 'lite' })
    writeGlassOverride(undefined, storage)
    expect(storage.data.has(GLASS_OVERRIDE_KEY)).toBe(false)
  })

  it('falls back to automatic and logs the module name when storage is blocked', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readGlassOverride(brokenStorage)).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[shell/glass-override] read'), expect.anything())
  })

  it('warns only once however often a blocked read repeats', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    readGlassOverride(brokenStorage)
    readGlassOverride(brokenStorage)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('with storage blocked, remembers the choice for the rest of the visit', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    writeGlassOverride('lite', brokenStorage)
    expect(readGlassOverride(brokenStorage)).toBe('lite')
    writeGlassOverride(undefined, brokenStorage)
    expect(readGlassOverride(brokenStorage)).toBeUndefined()
  })

  it('does not throw when a write is blocked, and logs the module name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => writeGlassOverride('lite', brokenStorage)).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[shell/glass-override] write'), expect.anything())
  })
})
