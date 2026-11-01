/**
 * Chooses which stored response to show for an objection, for the contact's
 * language mix. Falls back to English and says a rewrite is worth offering.
 * An empty mix counts as English (pickVariant refuses an empty mix). Pure.
 * Called by the ObjectionDrawer.
 */
import type { CallObjection } from '@/lib/call/callScreen'
import type { Mix, Register, Script } from '@/lib/domain'
import { pickVariant } from '@/lib/language/variants'

const SCRIPT: Script = 'latin'
const REGISTER: Register = 'formal'

export interface PickedResponse {
  body: string
  /** The shown text is English but the contact speaks something else. */
  needsRewrite: boolean
  isDraft: boolean
}

export function pickObjectionResponse(objection: CallObjection, mix: Mix): PickedResponse {
  const wanted: Mix = mix.length > 0 ? mix : ['en']
  const picked = pickVariant(objection.responses.map((response) => response.variant), {
    mix: wanted, script: SCRIPT, register: REGISTER,
  })
  if (picked === null) return { body: '', needsRewrite: false, isDraft: false }

  const isDraft = objection.responses.find((response) => response.variant.id === picked.variant.id)?.isDraft ?? false
  const canRewrite = picked.match === 'english' && objection.englishId !== null
  return { body: picked.variant.body, needsRewrite: canRewrite, isDraft }
}
