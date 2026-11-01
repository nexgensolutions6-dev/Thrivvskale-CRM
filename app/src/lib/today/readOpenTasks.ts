/**
 * Reads the open tasks (not done, with a due time) that fall due before
 * `before`, with their company names. Uses the user's client, so RLS applies.
 * Called by loadToday.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import type { TodayTask } from './types'

const MODULE = 'readOpenTasks'
const MAX_TASKS = 500

export async function readOpenTasks(
  db: SupabaseClient<Database>,
  workspaceId: string,
  before: Date,
): Promise<TodayTask[]> {
  const result = await db.from('tasks').select('id, type, title, due_at, company_id, companies(name)')
    .eq('workspace_id', workspaceId).is('done_at', null).not('due_at', 'is', null)
    .lt('due_at', before.toISOString()).order('due_at').limit(MAX_TASKS)
  if (result.error) throw stepError(MODULE, 'read open tasks', result.error)
  return result.data.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    dueAt: new Date(row.due_at as string),
    companyId: row.company_id,
    companyName: row.companies?.name ?? null,
  }))
}
