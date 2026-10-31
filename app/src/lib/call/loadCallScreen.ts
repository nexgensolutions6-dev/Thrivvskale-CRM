/**
 * `loadCallScreen`: what the /call page needs: the ranked queue split into
 * "call now" and "scheduled for later", the next batch of leads prepared in
 * full, and the objection list. Uses the user's client, so RLS applies. Called by
 * the /call page and the DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import holidaysJson from '../../../supabase/seed/holidays.json'
import type { Database } from '@/lib/db/types'
import type { Holiday } from '@/lib/calendar/schedule'
import { loadLead } from '@/lib/leads/loadLead'
import { rankQueue } from '@/lib/queue/rank'
import { stepError } from '@/lib/step-error'
import { buildCallLead } from './buildCallLead'
import type { CallObjection, CallScreen } from './callScreen'
import { loadQueueItems } from './loadQueueItems'

const MODULE = 'loadCallScreen'
/** Leads prepared per page load, so the cockpit can advance offline without one query per tap. */
const BATCH_SIZE = 8
const MAX_OBJECTIONS = 200
const HOLIDAYS: Holiday[] = holidaysJson

type Db = SupabaseClient<Database>

async function readWorkspaceCalendar(db: Db, workspaceId: string) {
  const result = await db.from('workspaces').select('working_days, home_state').eq('id', workspaceId).single()
  if (result.error) throw stepError(MODULE, `read calendar of workspace ${workspaceId}`, result.error)
  return result.data
}

async function readObjections(db: Db, workspaceId: string): Promise<CallObjection[]> {
  const result = await db.from('objections').select('id, text').eq('workspace_id', workspaceId)
    .order('text').limit(MAX_OBJECTIONS)
  if (result.error) throw stepError(MODULE, 'read objections', result.error)
  return result.data
}

export async function loadCallScreen(db: Db, workspaceId: string, now: Date): Promise<CallScreen> {
  const [items, workspace, objections] = await Promise.all([
    loadQueueItems(db, workspaceId),
    readWorkspaceCalendar(db, workspaceId),
    readObjections(db, workspaceId),
  ])
  const ranked = rankQueue(items, { now })
  const callNow = ranked.filter((item) => item.dueAt === null || item.dueAt.getTime() <= now.getTime())
  const batch = callNow.slice(0, BATCH_SIZE)

  const calendar = { workingDays: workspace.working_days, holidays: HOLIDAYS }
  const views = await Promise.all(batch.map((item) => loadLead(db, workspaceId, item.companyId)))
  return {
    leads: views.map((view) => buildCallLead(view, now, calendar, workspace.home_state)),
    moreWaiting: callNow.length > batch.length,
    scheduledLater: ranked.length - callNow.length,
    objections,
  }
}
