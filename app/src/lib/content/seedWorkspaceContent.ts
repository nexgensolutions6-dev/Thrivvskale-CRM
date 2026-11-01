/**
 * `seedWorkspaceContent(workspaceId)`: gives a workspace its starter playbooks,
 * objections and WhatsApp templates, then sets `content_seeded_at`, but only
 * after all three parts succeeded. Safe to rerun (existing rows are never
 * changed or duplicated). Uses the service-role client.
 * Called by ensureWorkspace (new workspace) and seedIfNotSeeded (retry).
 */
import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { stepError } from '@/lib/step-error'
import { seedObjections } from './seedObjections'
import { seedPlaybooks } from './seedPlaybooks'
import { seedTemplates } from './seedTemplates'

const MODULE = 'seedWorkspaceContent'

export async function seedWorkspaceContent(workspaceId: string): Promise<void> {
  const db = createSupabaseAdminClient()
  await seedPlaybooks(db, workspaceId)
  await seedObjections(db, workspaceId)
  await seedTemplates(db, workspaceId)
  const marked = await db.from('workspaces').update({ content_seeded_at: new Date().toISOString() }).eq('id', workspaceId)
  if (marked.error) throw stepError(MODULE, `set seed marker of workspace ${workspaceId}`, marked.error)
}
