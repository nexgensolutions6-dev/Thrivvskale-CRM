/**
 * Kolkata calendar helpers. Turns an instant into its Asia/Kolkata date
 * (YYYY-MM-DD), does date arithmetic on those strings, and builds an instant
 * from a Kolkata date plus "HH:MM". Never reads the process timezone.
 * Called by schedule.ts and isWorkingDay.ts.
 */
import { stepError } from '@/lib/step-error'

const MODULE = 'calendar/kolkataDate'

/** India has no daylight saving, so Kolkata is always UTC+05:30. */
const KOLKATA_OFFSET_MINUTES = 5 * 60 + 30

const KOLKATA_DATE_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** The Kolkata calendar date (YYYY-MM-DD) that contains this instant. */
export function kolkataYmd(instant: Date): string {
  if (Number.isNaN(instant.getTime())) {
    throw stepError(MODULE, 'read the Kolkata date', `instant is an invalid Date (${String(instant)})`)
  }
  const parts = KOLKATA_DATE_PARTS.formatToParts(instant)
  const pick = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

/** Splits "YYYY-MM-DD" into numbers, rejecting anything that is not a real date. */
function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const match = YMD_PATTERN.exec(ymd)
  if (!match) throw stepError(MODULE, 'parse a date', `"${ymd}" is not YYYY-MM-DD`)
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw stepError(MODULE, 'parse a date', `"${ymd}" is not a real calendar date`)
  }
  return { year, month, day }
}

/** The date `days` after `ymd` (negative goes back). Pure calendar arithmetic. */
export function addDays(ymd: string, days: number): string {
  const { year, month, day } = parseYmd(ymd)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** ISO weekday of a date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(ymd: string): number {
  const { year, month, day } = parseYmd(ymd)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = Sunday
  return jsDay === 0 ? 7 : jsDay
}

/** Checks an "HH:MM" string; `label` names the field in the error (e.g. "window.start"). */
export function parseHhMm(value: string, label: string): { hour: number; minute: number } {
  const match = HH_MM_PATTERN.exec(value)
  if (!match) throw stepError(MODULE, `parse ${label}`, `"${value}" is not HH:MM (24-hour)`)
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

/** The instant at which the Kolkata clock reads `hhmm` on date `ymd`. */
export function kolkataInstant(ymd: string, hhmm: string): Date {
  const { year, month, day } = parseYmd(ymd)
  const { hour, minute } = parseHhMm(hhmm, 'time of day')
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - KOLKATA_OFFSET_MINUTES * 60_000
  return new Date(utcMs)
}
