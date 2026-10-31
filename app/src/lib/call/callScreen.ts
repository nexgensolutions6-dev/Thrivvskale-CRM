/**
 * The serialisable shapes the /call page hands to the client cockpit: one
 * prepared lead per card and the screen around them. Prepared on the server so
 * the cockpit keeps advancing through leads while offline. Types only.
 */
import type { Mix } from '@/lib/domain'
import type { PickerOpener, PickerPoint } from '@/lib/leads/openerChoices'

export interface CallPoint extends PickerPoint {
  /** The mix chips pre-filled for this number: its owner's mix, else the lead's. */
  mix: Mix
}

export interface CallLead {
  companyId: string
  name: string
  vertical: string | null
  area: string | null
  problemEvidence: string | null
  entryOffer: string | null
  mixLabel: string
  openers: PickerOpener[]
  points: CallPoint[]
  /** ISO instant of the next working slot, pre-filled as the callback date. */
  callbackDefault: string
}

export interface CallObjection {
  id: string
  text: string
}

export interface CallScreen {
  /** The next leads to call, best first. */
  leads: CallLead[]
  /** More leads are ready after this batch. */
  moreWaiting: boolean
  /** Leads whose callback is not due yet: not called now, not lost either. */
  scheduledLater: number
  objections: CallObjection[]
}
