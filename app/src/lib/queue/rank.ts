/**
 * Builds the calling queue: drops companies that must not be called, applies
 * the cockpit filters, then sorts with compareItems. Pure; the data-loading
 * layer supplies QueueItems and the cockpit page renders the result.
 */
import { stepError } from '@/lib/step-error'
import { compareItems } from './compareItems'
import { isExcluded } from './isExcluded'
import { matchesFilters } from './matchesFilters'
import type { QueueFilters, QueueItem } from './types'

export type { QueueFilters, QueueItem } from './types'

const MODULE = 'queue/rank'

export function rankQueue(
  items: QueueItem[],
  opts: { now: Date; filters?: QueueFilters },
): QueueItem[] {
  const { now, filters } = opts
  if (Number.isNaN(now.getTime())) {
    throw stepError(MODULE, 'check opts.now', 'now is an invalid Date')
  }

  return items
    .filter((item) => {
      assertDueAtIsValid(item)
      return !isExcluded(item) && matchesFilters(item, filters)
    })
    .sort((a, b) => compareItems(a, b, now))
}

/** An invalid dueAt would make every comparison NaN, so fail loudly with the company id. */
function assertDueAtIsValid(item: QueueItem): void {
  if (item.dueAt !== null && Number.isNaN(item.dueAt.getTime())) {
    throw stepError(MODULE, `check dueAt of company ${item.companyId}`, 'dueAt is an invalid Date')
  }
}
