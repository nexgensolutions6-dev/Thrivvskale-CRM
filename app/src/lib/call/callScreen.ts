/**
 * The serialisable shapes the /call page hands to the client cockpit: one
 * prepared lead per card and the screen around them. Prepared on the server so
 * the cockpit keeps advancing through leads while offline. Types only.
 */
import type { Mix } from '@/lib/domain'
import type { ContentVariant } from '@/lib/language/types'
import type { PickerOpener, PickerPoint } from '@/lib/leads/openerChoices'

export interface CallPoint extends PickerPoint {
  /** The mix chips pre-filled for this number: its owner's mix, else the lead's. */
  mix: Mix
  /** The name a message to this number starts with: its owner's, else the primary contact's. */
  greetingName: string | undefined
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

/** One stored answer to an objection: the English original or a rewrite in another mix. */
export interface ObjectionResponse {
  variant: ContentVariant
  /** An AI rewrite the user has not approved yet. */
  isDraft: boolean
}

export interface CallObjection {
  id: string
  text: string
  /** The English response a rewrite starts from; null if the objection has none. */
  englishId: string | null
  responses: ObjectionResponse[]
}

/** One WhatsApp follow-up template: the English text and any rewrites of it. */
export interface CallTemplate {
  /** The English variant's id. */
  id: string
  title: string
  variants: ContentVariant[]
}

export interface CallScreen {
  /** The next leads to call, best first. */
  leads: CallLead[]
  /** More leads are ready after this batch. */
  moreWaiting: boolean
  /** Leads whose callback is not due yet: not called now, not lost either. */
  scheduledLater: number
  objections: CallObjection[]
  templates: CallTemplate[]
}
