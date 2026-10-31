/**
 * Looks up which workspace a user belongs to (their oldest membership), or
 * null when they have none. Called by `ensure-workspace.ts` (service-role
 * client) and `get-session-workspace.ts` (the user's own client, so row-level
 * security applies).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'

export async function findWorkspaceIdForUser(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw stepError('findWorkspaceIdForUser', 'select membership', error)

  return data?.workspace_id ?? null
}
