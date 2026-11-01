/**
 * `seedIfEmpty(workspaceId)`: runs the starter-content seed when the workspace
 * has no playbooks yet, so a seed that failed at sign-up is retried at the next
 * sign-in. Does nothing for a workspace that already has content. Uses the
 * service-role client. Called by the auth callback route.
 */
import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { stepError } from '@/lib/step-error'
import { seedWorkspaceContent } from './seedWorkspaceContent'

const MODULE = 'seedIfEmpty'

export async function seedIfEmpty(workspaceId: string): Promise<void> {
  const db = createSupabaseAdminClient()
  const existing = await db.from('playbooks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
  if (existing.error) throw stepError(MODULE, `count playbooks of workspace ${workspaceId}`, existing.error)
  if ((existing.count ?? 0) > 0) return
  await seedWorkspaceContent(workspaceId)
}
