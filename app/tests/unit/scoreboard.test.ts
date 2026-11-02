/**
 * Unit tests for the scoreboard's pure parts: the streak count, which target
 * applies on a day, and the runtime validation of the targets form.
 */
import { describe, expect, it } from 'vitest'
import { countStreak } from '@/lib/scoreboard/streak'
import { targetOn, type TargetRow } from '@/lib/scoreboard/targetOn'
import { validateTargets } from '@/lib/scoreboard/validateTargets'

const noRestDays = () => false
const sundayIsRest = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay() === 0

describe('countStreak', () => {
  it('counts consecutive met days ending today', () => {
    expect(countStreak(new Set(['2026-10-30', '2026-10-31', '2026-11-01']), '2026-11-01', noRestDays)).toBe(3)
  })

  it('does not break when today is not met yet, it counts back from yesterday', () => {
    expect(countStreak(new Set(['2026-10-30', '2026-10-31']), '2026-11-01', noRestDays)).toBe(2)
  })

  it('breaks on a missed day', () => {
    expect(countStreak(new Set(['2026-10-29', '2026-10-31', '2026-11-01']), '2026-11-01', noRestDays)).toBe(2)
  })

  it('steps over an unmet Sunday: Monday to Saturday met across a Sunday counts 7', () => {
    const met = new Set(['2026-10-24', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'])
    expect(countStreak(met, '2026-10-31', sundayIsRest)).toBe(7)
  })

  it('steps over today when it is an unmet rest day, and still breaks on an unmet working day', () => {
    expect(countStreak(new Set(['2026-10-30', '2026-10-31']), '2026-11-01', sundayIsRest)).toBe(2)
    expect(countStreak(new Set(['2026-10-24', '2026-10-26', '2026-10-27', '2026-10-29', '2026-10-30', '2026-10-31']), '2026-10-31', sundayIsRest)).toBe(3)
  })

  it('stops at the 365 day lookback', () => {
    const all = new Set(Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2026, 10, 1) - i * 86_400_000).toISOString().slice(0, 10)))
    expect(countStreak(all, '2026-11-01', noRestDays)).toBe(366)
  })

  it('is 0 with no met days, or when yesterday and today are both missed', () => {
    expect(countStreak(new Set(), '2026-11-01', noRestDays)).toBe(0)
    expect(countStreak(new Set(['2026-10-29']), '2026-11-01', noRestDays)).toBe(0)
  })
})

describe('targetOn', () => {
  const rows: TargetRow[] = [
    { effective_from: '2026-10-01', dials: 20, conversations: 4, meetings_booked: 1 },
    { effective_from: '2026-10-20', dials: 40, conversations: 8, meetings_booked: 2 },
  ]

  it('uses the latest row that started on or before the day', () => {
    expect(targetOn(rows, '2026-10-19')).toEqual({ calls: 20, conversations: 4, demos: 1 })
    expect(targetOn(rows, '2026-10-20')).toEqual({ calls: 40, conversations: 8, demos: 2 })
  })

  it('is all zero before the first row', () => {
    expect(targetOn(rows, '2026-09-30')).toEqual({ calls: 0, conversations: 0, demos: 0 })
  })
})

describe('validateTargets', () => {
  it('accepts whole numbers from text and returns numbers', () => {
    expect(validateTargets({ calls: '40', conversations: '8', demos: '0' })).toEqual({
      calls: 40, conversations: 8, demos: 0,
    })
  })

  it.each([
    ['empty', { calls: '', conversations: '1', demos: '1' }, /calls/i],
    ['negative', { calls: '-1', conversations: '1', demos: '1' }, /calls/i],
    ['fractional', { calls: '1', conversations: '2.5', demos: '1' }, /conversations/i],
    ['text', { calls: '1', conversations: '1', demos: 'many' }, /demos/i],
    ['too large', { calls: '100000', conversations: '1', demos: '1' }, /calls/i],
    ['not an object', null, /targets/i],
  ])('refuses %s with a friendly message', (_name, raw, pattern) => {
    expect(() => validateTargets(raw)).toThrow(pattern)
    expect(() => validateTargets(raw)).not.toThrow(/\[|code|violates/)
  })
})
