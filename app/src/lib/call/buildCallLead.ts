/**
 * Turns a LeadView into the CallLead one call card shows. Openers come from
 * buildOpenerChoices, so a company's own CSV opener is first and another
 * company's never shows. Pure. Called by loadCallScreen.
 */
import { contactMix, leadMix } from '@/lib/leads/contactMix'
import type { LeadView } from '@/lib/leads/leadView'
import { buildOpenerChoices } from '@/lib/leads/openerChoices'
import { pickPrimaryContact } from '@/lib/leads/primaryContact'
import { callbackSlotFor, type WorkCalendar } from './callbackSlot'
import type { CallLead, CallPoint } from './callScreen'

export function buildCallLead(view: LeadView, now: Date, calendar: WorkCalendar, homeState: string | null): CallLead {
  const { company } = view
  const choices = buildOpenerChoices(view)
  const state = company.state ?? homeState
  return {
    companyId: company.id,
    name: company.name,
    vertical: company.vertical,
    area: company.area,
    problemEvidence: company.problem_evidence,
    entryOffer: view.entryOffer,
    mixLabel: choices.mixLabel,
    openers: choices.openers,
    points: ownersFirst(view, choices.points),
    callbackDefault: callbackSlotFor(now, { vertical: company.vertical, state }, calendar).toISOString(),
  }
}

/** Primary contact's numbers come first, so the default number reaches the right person. */
function ownersFirst(view: LeadView, points: ReturnType<typeof buildOpenerChoices>['points']): CallPoint[] {
  const primary = pickPrimaryContact(view.contacts)
  const lead = leadMix(primary, view.workspaceMix)
  const withMix = points.map((point, index) => {
    const ownerId = view.points[index].contactId
    const owner = view.contacts.find((contact) => contact.id === ownerId)
    const mix = (owner && contactMix(owner)) ?? lead
    const greetingName = greetingNameOf(owner ?? primary)
    return { point: { ...point, mix, greetingName }, isPrimary: ownerId === primary?.id }
  })
  return [...withMix.filter((row) => row.isPrimary), ...withMix.filter((row) => !row.isPrimary)].map((row) => row.point)
}

/** The name a message starts with: the Latin-script name when there is one. */
function greetingNameOf(contact: { nameLatin: string | null; name: string | null } | null | undefined): string | undefined {
  return contact ? (contact.nameLatin ?? contact.name ?? undefined) : undefined
}
