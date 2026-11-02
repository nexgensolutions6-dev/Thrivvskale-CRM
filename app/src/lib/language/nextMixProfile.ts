/**
 * Decides which language mix to use on the next call: the most frequent mix
 * among the last 3 spoken ones (ties go to the most recent). Re-exported by
 * mix.ts; used when the cockpit advances to the next lead.
 */
import type { Mix } from '@/lib/domain'
import { sameMix } from './sameMix'

const WINDOW = 3

/** `recentSpoken` is ordered oldest to newest. */
export function nextMixProfile(current: Mix, recentSpoken: Mix[]): Mix {
  const window = recentSpoken.slice(-WINDOW)
  let best: Mix = current
  let bestCount = 0
  // Walk newest to oldest and only replace on a strictly higher count,
  // so a tie keeps the more recent mix.
  for (let i = window.length - 1; i >= 0; i--) {
    const candidate = window[i]
    const count = window.filter((m) => sameMix(m, candidate)).length
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}
