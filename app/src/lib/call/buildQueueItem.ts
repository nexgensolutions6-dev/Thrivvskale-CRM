/**
 * Turns one company row into a QueueItem: flags, mix, dynamic score and due
 * time. A lead already called with nothing scheduled returns null, because
 * rankQueue reads a null due time as "never called". Pure. Called by loadQueueItems.
 */
import type { Mix, Outcome, Priority, Tier } from '@/lib/domain'
import { dynamicScore } from '@/lib/queue/dynamicScore'
import type { QueueItem } from '@/lib/queue/types'

const DEFAULT_PRIORITY: Priority = 'C'
const FALLBACK_MIX: Mix = ['en']

export interface QueueCompany {
  id: string
  tier: Tier
  priority: Priority | null
  base_score: number
  vertical: string | null
  area: string | null
  website_status: string | null
  intent_signal: string | null
  dnd: boolean
  needs_number: boolean
  wrong_number: boolean
  last_contacted_at: string | null
  next_action_at: string | null
}

export interface QueueContext {
  outcomes: Outcome[]
  /** The lead's mix (primary contact's, else workspace default). */
  mix: Mix
  hasNumber: boolean
}

export function buildQueueItem(company: QueueCompany, context: QueueContext): QueueItem | null {
  if (company.last_contacted_at !== null && company.next_action_at === null) return null

  return {
    companyId: company.id,
    tier: company.tier,
    priority: company.priority ?? DEFAULT_PRIORITY,
    score: dynamicScore(company.base_score, { intent: Boolean(company.intent_signal), outcomes: context.outcomes }),
    dueAt: company.next_action_at === null ? null : new Date(company.next_action_at),
    dnd: company.dnd,
    needsNumber: company.needs_number || !context.hasNumber,
    wrongNumber: company.wrong_number,
    vertical: company.vertical ?? '',
    area: company.area ?? '',
    mix: context.mix.length > 0 ? context.mix : FALLBACK_MIX,
    websiteStatus: company.website_status ?? '',
  }
}
