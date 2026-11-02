/**
 * `getLead(id)`: the lead workspace data for the signed-in user. Finds the
 * user's workspace, then loads the lead with their own (row-level security)
 * client. Called by the /leads/[id] page; throws LeadNotFoundError.
 */
import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'
import type { LeadView } from './leadView'
import { loadLead } from './loadLead'

export async function getLead(id: string): Promise<LeadView> {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  return loadLead(db, workspaceId, id)
}
