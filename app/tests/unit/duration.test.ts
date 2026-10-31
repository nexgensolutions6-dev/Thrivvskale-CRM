/**
 * Unit tests for estimateDurationSeconds: time away from the app becomes the
 * estimated call length, and under 5 seconds away means the call was not placed.
 */
import { describe, expect, it } from 'vitest'
import { estimateDurationSeconds } from '@/lib/call/duration'

describe('estimateDurationSeconds', () => {
  it('turns time away into whole seconds', () => {
    expect(estimateDurationSeconds(1000, 1000 + 185_000)).toBe(185)
  })

  it('says the call was not placed when away under 5 seconds', () => {
    expect(estimateDurationSeconds(1000, 1000 + 3_000)).toBeNull()
    expect(estimateDurationSeconds(1000, 1000 + 4_999)).toBeNull()
  })

  it('counts exactly 5 seconds as a call', () => {
    expect(estimateDurationSeconds(1000, 1000 + 5_000)).toBe(5)
  })

  it('treats a clock that went backwards or a bad number as not placed', () => {
    expect(estimateDurationSeconds(9000, 1000)).toBeNull()
    expect(estimateDurationSeconds(Number.NaN, 1000)).toBeNull()
  })
})
