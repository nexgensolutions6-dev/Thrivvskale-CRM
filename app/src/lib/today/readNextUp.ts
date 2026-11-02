/**
 * "Next up": the top lead the call queue would offer right now. Reuses the
 * queue loader and ranking of the call screen, then skips leads scheduled for
 * later (same rule as loadCallScreen). Uses the user's client, so RLS applies.
 * Called by loadToday.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadQueueItems } from '@/lib/call/loadQueueItems'
import type { Database } from '@/lib/db/types'
import { rankQueue } from '@/lib/queue/rank'
import { stepError } from '@/lib/step-error'
import type { NextUp } from './types'

const MODULE = 'readNextUp'

export async function readNextUp(db: SupabaseClient<Database>, workspaceId: string, now: Date): Promise<NextUp> {
  const ranked = rankQueue(await loadQueueItems(db, workspaceId), { now })
  const top = ranked.find((item) => item.dueAt === null || item.dueAt.getTime() <= now.getTime())
  if (!top) return null
  const company = await db.from('companies').select('name').eq('workspace_id', workspaceId)
    .eq('id', top.companyId).single()
  if (company.error) throw stepError(MODULE, `read name of company ${top.companyId}`, company.error)
  return { companyId: top.companyId, name: company.data.name }
}
