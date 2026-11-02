/**
 * `seedIfNotSeeded(workspaceId)`: runs the starter-content seed only while the
 * workspace's `content_seeded_at` marker is null, so a seed that failed part
 * way is finished at the next sign-in. Never touches a seeded or healed
 * workspace. Uses the service-role client. Called by the auth callback route.
 */
import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { stepError } from '@/lib/step-error'
import { seedWorkspaceContent } from './seedWorkspaceContent'

const MODULE = 'seedIfNotSeeded'

export async function seedIfNotSeeded(workspaceId: string): Promise<void> {
  const db = createSupabaseAdminClient()
  const row = await db.from('workspaces').select('content_seeded_at').eq('id', workspaceId).maybeSingle()
  if (row.error) throw stepError(MODULE, `read seed marker of workspace ${workspaceId}`, row.error)
  if (!row.data || row.data.content_seeded_at) return
  await seedWorkspaceContent(workspaceId)
}
