/**
 * Says whether a company must never appear in the calling queue: do-not-disturb,
 * no usable number yet, or a number known to be wrong. Called by rank.ts.
 */
import type { QueueItem } from './types'

export function isExcluded(item: QueueItem): boolean {
  return item.dnd || item.needsNumber || item.wrongNumber
}
