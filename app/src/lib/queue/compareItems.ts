/**
 * The queue sort order, as a comparator. Groups, in order: due now (earliest
 * due first), never called (core, then A/B/C, then higher score), scheduled
 * for later (soonest first). Ties fall back to companyId so the order is
 * stable. Called by rank.ts.
 */
import type { QueueItem } from './types'

const TIER_ORDER = { core: 0, exploratory: 1 } as const
const PRIORITY_ORDER = { A: 0, B: 1, C: 2 } as const

/** Which group an item sorts into; lower groups come first. */
const GROUP_DUE = 0
const GROUP_NEVER_CALLED = 1
const GROUP_SCHEDULED_LATER = 2

function groupOf(item: QueueItem, now: Date): number {
  if (item.dueAt === null) return GROUP_NEVER_CALLED
  return item.dueAt.getTime() <= now.getTime() ? GROUP_DUE : GROUP_SCHEDULED_LATER
}

export function compareItems(a: QueueItem, b: QueueItem, now: Date): number {
  const groupA = groupOf(a, now)
  const groupB = groupOf(b, now)
  if (groupA !== groupB) return groupA - groupB

  if (groupA === GROUP_NEVER_CALLED) {
    const byTier = TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
    if (byTier !== 0) return byTier

    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (byPriority !== 0) return byPriority

    const byScore = b.score - a.score // higher score first
    if (byScore !== 0) return byScore
  } else {
    // Due and scheduled-later groups: earlier dueAt first (dueAt is non-null here).
    const byDueAt = a.dueAt!.getTime() - b.dueAt!.getTime()
    if (byDueAt !== 0) return byDueAt
  }

  return a.companyId.localeCompare(b.companyId)
}
