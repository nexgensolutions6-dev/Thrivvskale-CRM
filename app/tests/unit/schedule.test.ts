import { afterEach, describe, expect, it, vi } from 'vitest'
import holidaysSeed from '../../supabase/seed/holidays.json'
import { BEST_WINDOWS, windowKeyForVertical } from '@/lib/calendar/windows'
import { nextCallbackSlot, type Holiday } from '@/lib/calendar/schedule'

const MON_TO_SAT = [1, 2, 3, 4, 5, 6]
const MON_TO_FRI = [1, 2, 3, 4, 5]
const WINDOW_11 = { start: '11:00', end: '13:00' }

// Fixture holidays: a Telangana-only holiday on Monday 2026-11-09.
const FIXTURE_HOLIDAYS: Holiday[] = [
  { region: 'Telangana', date: '2026-11-09', name: 'Fixture holiday' },
]

function slot(from: string, overrides: Partial<Parameters<typeof nextCallbackSlot>[1]> = {}): string {
  return nextCallbackSlot(new Date(from), {
    state: 'Telangana',
    holidays: [],
    workingDays: MON_TO_SAT,
    window: WINDOW_11,
    ...overrides,
  }).toISOString()
}

describe('nextCallbackSlot', () => {
  it('moves a Saturday-evening request to Monday at window start, skipping Sunday', () => {
    // Sat 2026-11-07 20:00 IST = 14:30Z. Monday 2026-11-09 11:00 IST = 05:30Z.
    expect(slot('2026-11-07T14:30:00Z')).toBe('2026-11-09T05:30:00.000Z')
  })

  it('returns window start on the next day for a normal weekday', () => {
    // Tue 2026-11-03 15:00 IST -> Wed 2026-11-04 11:00 IST = 05:30Z.
    expect(slot('2026-11-03T09:30:00Z')).toBe('2026-11-04T05:30:00.000Z')
  })

  it('keeps the minutes of the window start (10:30 IST = 05:00Z)', () => {
    expect(slot('2026-11-03T09:30:00Z', { window: { start: '10:30', end: '12:30' } })).toBe(
      '2026-11-04T05:00:00.000Z',
    )
  })

  it('honours minDays', () => {
    // Tue Nov 3 + 3 days = Fri Nov 6.
    expect(slot('2026-11-03T09:30:00Z', { minDays: 3 })).toBe('2026-11-06T05:30:00.000Z')
  })

  it('skips a state holiday for that state but not for another state', () => {
    // Fri 2026-11-06 12:00 IST; Sat/Sun are off, so the next weekday is Mon Nov 9.
    const from = '2026-11-06T06:30:00Z'
    const telangana = slot(from, { workingDays: MON_TO_FRI, holidays: FIXTURE_HOLIDAYS })
    const karnataka = slot(from, {
      workingDays: MON_TO_FRI,
      holidays: FIXTURE_HOLIDAYS,
      state: 'Karnataka',
    })
    expect(telangana).toBe('2026-11-10T05:30:00.000Z') // Tue Nov 10
    expect(karnataka).toBe('2026-11-09T05:30:00.000Z') // Mon Nov 9
  })

  it('matches the state name ignoring case and extra spaces', () => {
    const from = '2026-11-06T06:30:00Z'
    expect(slot(from, { workingDays: MON_TO_FRI, holidays: FIXTURE_HOLIDAYS, state: ' telangana ' })).toBe(
      '2026-11-10T05:30:00.000Z',
    )
  })

  it('skips several consecutive holidays', () => {
    const holidays: Holiday[] = [
      { region: 'Telangana', date: '2026-11-09', name: 'A' },
      { region: 'Telangana', date: '2026-11-10', name: 'B' },
    ]
    expect(slot('2026-11-06T06:30:00Z', { workingDays: MON_TO_FRI, holidays })).toBe(
      '2026-11-11T05:30:00.000Z',
    )
  })

  it('uses the Kolkata date: 2026-11-01T20:00Z is already Nov 2 in IST', () => {
    // Nov 2 (Mon) + 1 day = Tue Nov 3 at 11:00 IST = 05:30Z.
    expect(slot('2026-11-01T20:00:00Z')).toBe('2026-11-03T05:30:00.000Z')
  })

  it('switches Kolkata day exactly at 18:30Z', () => {
    // 18:29:59Z is still Sun Nov 1 IST -> Mon Nov 2. 18:30:00Z is Mon Nov 2 IST -> Tue Nov 3.
    expect(slot('2026-11-01T18:29:59Z')).toBe('2026-11-02T05:30:00.000Z')
    expect(slot('2026-11-01T18:30:00Z')).toBe('2026-11-03T05:30:00.000Z')
  })

  describe('process timezone independence', () => {
    afterEach(() => vi.unstubAllEnvs())

    const INPUTS = [
      '2026-11-07T14:30:00Z',
      '2026-11-01T20:00:00Z',
      '2026-11-01T03:00:00Z',
      '2026-12-31T23:59:00Z',
    ]
    const resultsUnder = (tz: string): string[] => {
      vi.stubEnv('TZ', tz)
      return INPUTS.map((input) => slot(input))
    }

    it('gives identical results under TZ=UTC and TZ=America/New_York', () => {
      vi.stubEnv('TZ', 'UTC')
      const utcHour = new Date('2026-11-01T03:00:00Z').getHours()
      vi.stubEnv('TZ', 'America/New_York')
      const newYorkHour = new Date('2026-11-01T03:00:00Z').getHours()
      // Guard: proves the stubbed TZ really changed what local Date methods return.
      expect(utcHour).not.toBe(newYorkHour)

      const underUtc = resultsUnder('UTC')
      const underNewYork = resultsUnder('America/New_York')
      expect(underNewYork).toEqual(underUtc)
      expect(underUtc[1]).toBe('2026-11-03T05:30:00.000Z')
    })
  })

  describe('bad input names the module, step and value', () => {
    const base = { state: 'Telangana', holidays: [], workingDays: MON_TO_SAT, window: WINDOW_11 }

    it('rejects an invalid from date', () => {
      expect(() => nextCallbackSlot(new Date('nope'), base)).toThrow(/\[calendar\/schedule\].*from/)
    })
    it('rejects empty working days', () => {
      expect(() => nextCallbackSlot(new Date(), { ...base, workingDays: [] })).toThrow(/workingDays/)
    })
    it('rejects a weekday outside 1..7', () => {
      expect(() => nextCallbackSlot(new Date(), { ...base, workingDays: [0, 1] })).toThrow(/workingDays.*0/)
    })
    it('rejects a malformed window start', () => {
      expect(() =>
        nextCallbackSlot(new Date(), { ...base, window: { start: '25:99', end: '13:00' } }),
      ).toThrow(/window\.start.*25:99/)
    })
    it('rejects minDays below 1', () => {
      expect(() => nextCallbackSlot(new Date(), { ...base, minDays: 0 })).toThrow(/minDays.*0/)
    })
    it('gives up with a clear error if every day is a holiday', () => {
      const everyDay: Holiday[] = []
      for (let i = 0; i < 400; i++) {
        const day = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10)
        everyDay.push({ region: 'Telangana', date: day, name: 'x' })
      }
      expect(() =>
        nextCallbackSlot(new Date('2026-11-01T06:00:00Z'), { ...base, holidays: everyDay }),
      ).toThrow(/no working day within/)
    })
  })
})

describe('BEST_WINDOWS and windowKeyForVertical', () => {
  it('has the agreed starting windows', () => {
    expect(BEST_WINDOWS).toEqual({
      clinics: { start: '14:00', end: '16:00' },
      coaching: { start: '11:00', end: '15:00' },
      manufacturing: { start: '10:30', end: '12:30' },
      interiors: { start: '11:00', end: '13:00' },
      other: { start: '11:00', end: '13:00' },
    })
  })

  it('maps the core vertical names to their window keys', () => {
    expect(windowKeyForVertical('Clinics, Diagnostics & Pharmacies')).toBe('clinics')
    expect(windowKeyForVertical('Coaching & Education')).toBe('coaching')
    expect(windowKeyForVertical('Manufacturing & Furniture')).toBe('manufacturing')
    expect(windowKeyForVertical('Interiors & Modular')).toBe('interiors')
  })

  it('ignores case and extra whitespace', () => {
    expect(windowKeyForVertical('  CLINICS,   diagnostics  ')).toBe('clinics')
  })

  it('maps exploratory and unknown verticals to other', () => {
    expect(windowKeyForVertical('Real Estate & Construction')).toBe('other')
    expect(windowKeyForVertical('Automobile & Driving Schools')).toBe('other')
    expect(windowKeyForVertical('')).toBe('other')
  })

  it('only ever returns a key that exists in BEST_WINDOWS', () => {
    for (const name of ['Clinics', 'x', 'Coaching', 'Manufacturing', 'Interiors']) {
      expect(BEST_WINDOWS).toHaveProperty(windowKeyForVertical(name))
    }
  })
})

describe('supabase/seed/holidays.json', () => {
  const holidays = holidaysSeed as Holiday[]

  it('has well-formed, real, unique dates for the three states', () => {
    const seen = new Set<string>()
    for (const h of holidays) {
      expect(['Telangana', 'Karnataka', 'Andhra Pradesh']).toContain(h.region)
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${h.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(h.date)
      expect(h.name.trim()).not.toBe('')
      const key = `${h.region}|${h.date}`
      expect(seen.has(key), `duplicate ${key}`).toBe(false)
      seen.add(key)
    }
  })

  it('has entries for each of the three states', () => {
    for (const region of ['Telangana', 'Karnataka', 'Andhra Pradesh']) {
      expect(holidays.some((h) => h.region === region)).toBe(true)
    }
  })
})
