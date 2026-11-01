/**
 * `seedWorkspaceContent(workspaceId)`: gives a new workspace its starter
 * playbooks, objections and WhatsApp templates. Safe to run any number of times
 * (existing rows are never changed or duplicated). Uses the service-role client.
 * Called by ensureWorkspace, only when it created the workspace.
 */
import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { seedObjections } from './seedObjections'
import { seedPlaybooks } from './seedPlaybooks'
import { seedTemplates } from './seedTemplates'

export async function seedWorkspaceContent(workspaceId: string): Promise<void> {
  const db = createSupabaseAdminClient()
  await seedPlaybooks(db, workspaceId)
  await seedObjections(db, workspaceId)
  await seedTemplates(db, workspaceId)
}
