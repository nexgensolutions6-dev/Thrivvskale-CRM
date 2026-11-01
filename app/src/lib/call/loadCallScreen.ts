/**
 * `loadCallScreen`: what the /call page needs: the ranked queue split into
 * "call now" and "scheduled for later", the next batch of leads prepared in
 * full, the objection library and the WhatsApp templates. Uses the user's
 * client, so RLS applies. Called by the /call page and the DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import holidaysJson from '../../../supabase/seed/holidays.json'
import type { Database } from '@/lib/db/types'
import type { Holiday } from '@/lib/calendar/schedule'
import { readWorkspaceCalendar } from '@/lib/calendar/readWorkspaceCalendar'
import { loadLead } from '@/lib/leads/loadLead'
import { rankQueue } from '@/lib/queue/rank'
import { loadObjections } from '@/lib/content/loadObjections'
import { loadTemplates } from '@/lib/content/loadTemplates'
import { buildCallLead } from './buildCallLead'
import type { CallScreen } from './callScreen'
import { loadQueueItems } from './loadQueueItems'

/** Leads prepared per page load, so the cockpit can advance offline without one query per tap. */
const BATCH_SIZE = 8
const HOLIDAYS: Holiday[] = holidaysJson

type Db = SupabaseClient<Database>

export async function loadCallScreen(db: Db, workspaceId: string, now: Date): Promise<CallScreen> {
  const [items, workspace, objections, templates] = await Promise.all([
    loadQueueItems(db, workspaceId),
    readWorkspaceCalendar(db, workspaceId),
    loadObjections(db, workspaceId),
    loadTemplates(db, workspaceId),
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
    templates,
  }
}
