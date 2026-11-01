/**
 * `readWorkspaceCalendar`: a workspace's working weekdays and home state, the
 * two settings that decide which days count as working days. Uses the user's
 * client, so RLS applies. Called by loadCallScreen and getScoreboard.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'

const MODULE = 'readWorkspaceCalendar'

export async function readWorkspaceCalendar(db: SupabaseClient<Database>, workspaceId: string) {
  const result = await db.from('workspaces').select('working_days, home_state').eq('id', workspaceId).single()
  if (result.error) throw stepError(MODULE, `read calendar of workspace ${workspaceId}`, result.error)
  return result.data
}
