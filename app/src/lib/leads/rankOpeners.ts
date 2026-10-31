/**
 * Orders a lead's openers for its language mix: exact mix first, then same
 * primary language, then plain English; openers in other languages are left
 * out. Uses pickVariant, so the order follows the same rules as the calling
 * cockpit. Pure. Called by the lead page for the OpenerPicker.
 */
import type { Mix, Register, Script } from '@/lib/domain'
import { pickVariant, type ContentVariant, type MatchLevel } from '@/lib/language/variants'
import type { LeadOpener } from './leadView'

export interface RankedOpener {
  opener: LeadOpener
  match: MatchLevel
}

export function rankOpeners(
  openers: LeadOpener[],
  want: { mix: Mix; script: Script; register: Register },
): RankedOpener[] {
  const byId = new Map(openers.map((opener) => [opener.id, opener]))
  // An opener with no register of its own suits either tone, so it is never marked down for it.
  let remaining: ContentVariant[] = openers.map((opener) => ({
    id: opener.id,
    kind: 'opener',
    mix: opener.mix,
    script: opener.script,
    register: opener.register ?? want.register,
    body: opener.body,
    parentVariantId: null,
  }))

  const ranked: RankedOpener[] = []
  for (;;) {
    const picked = pickVariant(remaining, want)
    if (picked === null) return ranked
    const opener = byId.get(picked.variant.id)
    if (opener) ranked.push({ opener, match: picked.match })
    remaining = remaining.filter((variant) => variant.id !== picked.variant.id)
  }
}
