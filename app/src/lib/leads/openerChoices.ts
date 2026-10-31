/**
 * Prepares the opener picker's data from a LeadView: the lead's language mix
 * (primary contact's, else workspace default), the openers in that mix best
 * first with {name}, {company} and {honorific} filled in, and each phone
 * number with its owner's name. Pure. Called by the /leads/[id] page.
 */
import type { Mix, Register, Script, WaStatus } from '@/lib/domain'
import { honorificFor } from '@/lib/language/honorific'
import { toMixText } from '@/lib/language/mixText'
import { fillTemplate } from '@/lib/language/variants'
import { leadMix } from './contactMix'
import type { LeadView } from './leadView'
import { pickPrimaryContact } from './primaryContact'
import { rankOpeners } from './rankOpeners'

const DEFAULT_SCRIPT: Script = 'latin'
const DEFAULT_REGISTER: Register = 'formal'

const MATCH_LABELS = {
  exact: 'exact mix',
  primary: 'same main language',
  english: 'English',
  company: 'for this lead',
} as const

export interface PickerOpener {
  id: string
  /** The opener with {name}, {company} and {honorific} filled in. */
  text: string
  matchLabel: string
  mixLabel: string
}

export interface PickerPoint {
  id: string
  e164: string
  waStatus: WaStatus
  /** Who the number belongs to, e.g. "Ramesh" or "Company line". */
  owner: string
}

export interface OpenerChoices {
  mix: Mix
  mixLabel: string
  openers: PickerOpener[]
  points: PickerPoint[]
}

export function buildOpenerChoices(view: LeadView): OpenerChoices {
  const primary = pickPrimaryContact(view.contacts)
  const mix = leadMix(primary, view.workspaceMix)
  const script = primary?.scriptPref ?? DEFAULT_SCRIPT
  const register = primary?.register ?? DEFAULT_REGISTER
  const honorific = honorificFor(mix[0], register)
  const name = primary ? (primary.nameLatin ?? primary.name ?? undefined) : undefined

  const ranked = rankOpeners(view.openers, { mix, script, register })
  const openers = ranked.map(({ opener, match }) => ({
    id: opener.id,
    text: fillTemplate(opener.body, { name, company: view.company.name, honorific }),
    matchLabel: MATCH_LABELS[match],
    mixLabel: toMixText(opener.mix),
  }))

  const points = view.points.map((point) => {
    const owner = view.contacts.find((contact) => contact.id === point.contactId)
    return {
      id: point.id,
      e164: point.e164,
      waStatus: point.waStatus,
      owner: owner ? (owner.nameLatin ?? owner.name ?? 'contact') : 'company line',
    }
  })
  return { mix, mixLabel: toMixText(mix), openers, points }
}
