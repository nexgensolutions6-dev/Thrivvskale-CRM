/**
 * Finds one company of a workspace or throws "[module] find company <id>
 * failed: not found". The caller's client is subject to row-level security,
 * so another workspace's company is "not found" too. Used by saveContact and
 * addNote before they write anything.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'

export async function requireCompany(
  db: SupabaseClient<Database>,
  module: string,
  workspaceId: string,
  companyId: string,
): Promise<{ id: string; name: string }> {
  const found = await db
    .from('companies')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('id', companyId)
    .maybeSingle()
  if (found.error) throw stepError(module, `find company ${companyId}`, found.error)
  if (!found.data) throw stepError(module, `find company ${companyId}`, `not found in workspace ${workspaceId}`)
  return found.data
}
