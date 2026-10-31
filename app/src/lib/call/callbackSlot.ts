/**
 * The pre-filled callback time for a lead: the next working day in the lead's
 * state at the start of its vertical's best calling window. Pure. Called by
 * buildCallLead. Holidays cover 2026 only for now.
 */
import { nextCallbackSlot, type Holiday } from '@/lib/calendar/schedule'
import { BEST_WINDOWS, windowKeyForVertical } from '@/lib/calendar/windows'

export interface SlotLead {
  vertical: string | null
  state: string | null
}

export interface WorkCalendar {
  workingDays: number[]
  holidays: Holiday[]
}

export function callbackSlotFor(from: Date, lead: SlotLead, calendar: WorkCalendar): Date {
  return nextCallbackSlot(from, {
    state: lead.state ?? '',
    holidays: calendar.holidays,
    workingDays: calendar.workingDays,
    window: BEST_WINDOWS[windowKeyForVertical(lead.vertical ?? '')],
  })
}
