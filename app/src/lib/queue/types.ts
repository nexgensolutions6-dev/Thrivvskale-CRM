/**
 * Shapes shared by the queue modules: one row of the calling queue and the
 * filters a caller can apply. Re-exported from rank.ts, which is what the
 * data-loading layer and the cockpit UI import.
 */
import type { Mix, Priority, Tier } from '@/lib/domain'

export type QueueItem = {
  companyId: string
  tier: Tier
  priority: Priority
  /** Base score, usually the output of dynamicScore. Higher is called sooner. */
  score: number
  /** When the next call is due; null means the company was never called. */
  dueAt: Date | null
  dnd: boolean
  needsNumber: boolean
  wrongNumber: boolean
  vertical: string
  area: string
  /** Primary contact's language mix, else the workspace default; primary language first. */
  mix: Mix
  websiteStatus: string
}

/** Every filter that is set must match; unset filters are ignored. */
export type QueueFilters = {
  vertical?: string
  area?: string
  /** Matches `item.mix[0]`. */
  primaryLang?: string
  websiteStatus?: string
}
