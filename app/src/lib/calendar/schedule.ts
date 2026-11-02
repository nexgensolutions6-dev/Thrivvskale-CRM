/**
 * Picks the next callback time: at least `minDays` Kolkata days after `from`,
 * on a working day that is not a holiday in the lead's state, at the window
 * start. All date logic is Asia/Kolkata, never the process timezone.
 * Called when a call outcome asks for a callback.
 */
import { stepError } from '@/lib/step-error'
import { isWorkingDay } from './isWorkingDay'
import { addDays, kolkataInstant, kolkataYmd, parseHhMm } from './kolkataDate'
import type { CallbackSlotOptions } from './types'

export type { Holiday, TimeWindow, CallbackSlotOptions } from './types'

const MODULE = 'calendar/schedule'
const DEFAULT_MIN_DAYS = 1

/** How many days past the earliest day to search before giving up. */
const MAX_SEARCH_DAYS = 366

function checkOptions(from: Date, opts: CallbackSlotOptions, minDays: number): void {
  if (Number.isNaN(from.getTime())) {
    throw stepError(MODULE, 'check from', `from is an invalid Date (${String(from)})`)
  }
  if (opts.workingDays.length === 0) {
    throw stepError(MODULE, 'check workingDays', 'workingDays is empty, so no day can ever qualify')
  }
  for (const day of opts.workingDays) {
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      throw stepError(MODULE, 'check workingDays', `${String(day)} is not a weekday number from 1 (Mon) to 7 (Sun)`)
    }
  }
  if (!Number.isInteger(minDays) || minDays < 1) {
    throw stepError(MODULE, 'check minDays', `minDays must be a whole number >= 1, got ${String(minDays)}`)
  }
  parseHhMm(opts.window.start, 'window.start')
}

export function nextCallbackSlot(from: Date, opts: CallbackSlotOptions): Date {
  const minDays = opts.minDays ?? DEFAULT_MIN_DAYS
  checkOptions(from, opts, minDays)

  const earliestDay = addDays(kolkataYmd(from), minDays)
  for (let offset = 0; offset <= MAX_SEARCH_DAYS; offset++) {
    const day = addDays(earliestDay, offset)
    if (isWorkingDay(day, opts.state, opts.holidays, opts.workingDays)) {
      return kolkataInstant(day, opts.window.start)
    }
  }
  throw stepError(
    MODULE,
    'find a working day',
    `no working day within ${MAX_SEARCH_DAYS} days of ${earliestDay} for state "${opts.state}"`,
  )
}
