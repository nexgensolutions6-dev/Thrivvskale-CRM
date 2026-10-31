/**
 * Picks the best content variant for a wanted language mix, script and
 * register. Level (exact > primary > english) wins, then same script, then
 * same register, then input order. Re-exported by variants.ts.
 */
import { stepError } from '@/lib/step-error'
import { LEVEL_RANK, matchLevel } from './matchLevel'
import type { ContentVariant, MatchLevel, PickedVariant, WantedVariant } from './types'

type Scored = { variant: ContentVariant; match: MatchLevel; cost: number }

/** Smaller cost is better; level dominates, script outweighs register. */
function costOf(match: MatchLevel, variant: ContentVariant, want: WantedVariant): number {
  const scriptPenalty = variant.script === want.script ? 0 : 1
  const registerPenalty = variant.register === want.register ? 0 : 1
  return LEVEL_RANK[match] * 100 + scriptPenalty * 10 + registerPenalty
}

export function pickVariant(variants: ContentVariant[], want: WantedVariant): PickedVariant | null {
  if (want.mix.length === 0) {
    throw stepError('language/pickVariant', 'check wanted mix', 'wanted mix is empty, got []')
  }
  let best: Scored | null = null
  for (const variant of variants) {
    const match = matchLevel(variant.mix, want.mix)
    if (match === null) continue
    const cost = costOf(match, variant, want)
    // Strict "<" keeps the first variant in input order on a tie.
    if (best === null || cost < best.cost) best = { variant, match, cost }
  }
  return best === null ? null : { variant: best.variant, match: best.match }
}
