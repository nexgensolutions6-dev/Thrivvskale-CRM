/**
 * Orders a lead's openers for its language mix: exact mix first, then same
 * primary language, then plain English; openers in other languages are left
 * out; a lead's own opener (companyId set) comes before them all and is never
 * left out. Uses pickVariant, so the order follows the same rules as the calling
 * cockpit. Pure. Called by the lead page for the OpenerPicker.
 */
import type { Mix, Register, Script } from '@/lib/domain'
import { pickVariant, type ContentVariant, type MatchLevel } from '@/lib/language/variants'
import type { LeadOpener } from './leadView'

export interface RankedOpener {
  opener: LeadOpener
  /** "company" = written for this lead (its CSV opener); it fits any mix, so it is never left out. */
  match: MatchLevel | 'company'
}

type Want = { mix: Mix; script: Script; register: Register }

/** This lead's own openers first (best mix fit first), then the generic ones that fit the mix. */
export function rankOpeners(openers: LeadOpener[], want: Want): RankedOpener[] {
  const own = openers.filter((opener) => opener.companyId !== null)
  const generic = openers.filter((opener) => opener.companyId === null)
  const fitting = rankByFit(own, want)
  const fittingIds = new Set(fitting.map(({ opener }) => opener.id))
  const ownRanked: RankedOpener[] = [
    ...fitting.map(({ opener }) => ({ opener, match: 'company' as const })),
    // A company opener whose mix does not fit still shows, after the ones that do.
    ...own.filter((opener) => !fittingIds.has(opener.id)).map((opener) => ({ opener, match: 'company' as const })),
  ]
  return [...ownRanked, ...rankByFit(generic, want)]
}

function rankByFit(openers: LeadOpener[], want: Want): Array<{ opener: LeadOpener; match: MatchLevel }> {
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

  const ranked: Array<{ opener: LeadOpener; match: MatchLevel }> = []
  for (;;) {
    const picked = pickVariant(remaining, want)
    if (picked === null) return ranked
    const opener = byId.get(picked.variant.id)
    if (opener) ranked.push({ opener, match: picked.match })
    remaining = remaining.filter((variant) => variant.id !== picked.variant.id)
  }
}
