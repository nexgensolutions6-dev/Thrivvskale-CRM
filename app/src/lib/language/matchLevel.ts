/**
 * Works out how well one variant's language mix fits the wanted mix:
 * exact, primary (same first language) or english (plain English fallback).
 * Used by pickVariant.
 */
import type { Mix } from '@/lib/domain'
import type { MatchLevel } from './types'
import { sameMix } from './sameMix'

/** Lower rank is better. */
export const LEVEL_RANK: Record<MatchLevel, number> = { exact: 0, primary: 1, english: 2 }

/** Returns null when the variant fits at no level. */
export function matchLevel(variantMix: Mix, wantMix: Mix): MatchLevel | null {
  if (sameMix(variantMix, wantMix)) return 'exact'
  if (variantMix[0] === wantMix[0]) return 'primary'
  if (sameMix(variantMix, ['en'])) return 'english'
  return null
}
