/**
 * Applies the cockpit's queue filters to one item. Every filter that is set
 * must match exactly; unset ones are skipped. Called by rank.ts.
 */
import type { QueueFilters, QueueItem } from './types'

export function matchesFilters(item: QueueItem, filters: QueueFilters | undefined): boolean {
  if (!filters) return true

  if (filters.vertical !== undefined && item.vertical !== filters.vertical) return false
  if (filters.area !== undefined && item.area !== filters.area) return false
  if (filters.websiteStatus !== undefined && item.websiteStatus !== filters.websiteStatus) return false
  // primaryLang is the first language of the mix, not "anywhere in the mix".
  if (filters.primaryLang !== undefined && item.mix[0] !== filters.primaryLang) return false

  return true
}
