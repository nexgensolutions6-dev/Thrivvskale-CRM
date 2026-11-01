/**
 * Reads the open tasks (not done, with a due time) that fall due before
 * `before`, with their company names. Tasks of a do-not-disturb company are
 * left out in the query itself (not closed), so they come back if DND is
 * lifted and never use up the row limit; tasks with no company stay. Uses the
 * user's client, so RLS applies.
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
    .lt('due_at', before.toISOString())
    // The embed keeps only callable companies; a task then needs no company or a kept one.
    .eq('companies.dnd', false)
    .or('company_id.is.null,companies.not.is.null')
    .order('due_at').limit(MAX_TASKS)
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
