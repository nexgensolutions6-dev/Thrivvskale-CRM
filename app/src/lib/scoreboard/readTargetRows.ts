/**
 * Reads every targets row of a workspace (a handful at most: one per change).
 * Uses the user's client, so RLS applies. Called by getScoreboard and the
 * Targets page.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import type { TargetRow } from './targetOn'

const MODULE = 'readTargetRows'
const MAX_ROWS = 1000

export async function readTargetRows(db: SupabaseClient<Database>, workspaceId: string): Promise<TargetRow[]> {
  const result = await db.from('targets').select('effective_from, dials, conversations, meetings_booked')
    .eq('workspace_id', workspaceId).order('effective_from').limit(MAX_ROWS)
  if (result.error) throw stepError(MODULE, 'read targets', result.error)
  return result.data
}
