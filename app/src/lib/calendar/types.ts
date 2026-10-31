/**
 * Shared types for callback scheduling. No logic here.
 * Used by schedule.ts, holidayLookup.ts and isWorkingDay.ts, and by anything
 * that loads holidays from supabase/seed/holidays.json.
 */

/** A state holiday. `date` is the Kolkata calendar date as YYYY-MM-DD. */
export type Holiday = { region: string; date: string; name: string }

/** A calling window in Kolkata local time, "HH:MM" 24-hour strings. */
export type TimeWindow = { start: string; end: string }

export type CallbackSlotOptions = {
  /** State name matched against Holiday.region, e.g. "Telangana". */
  state: string
  holidays: Holiday[]
  /** ISO weekday numbers that are working days: 1 = Monday ... 7 = Sunday. */
  workingDays: number[]
  /** The callback is scheduled at window.start on the chosen day. */
  window: TimeWindow
  /** Earliest the callback may be, in whole Kolkata days after `from`. Default 1. */
  minDays?: number
}
