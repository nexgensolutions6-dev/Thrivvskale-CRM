/**
 * `setContactPointVisibility`: marks one phone number owner_only or workspace.
 * Uses the user's client (RLS applies) and only touches a number of the given
 * workspace; an unknown or foreign id is an error naming the id. Called by the
 * setPointVisibility server action and the DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { requireId, requireVisibility } from './validatePrivacyInput'

const MODULE = 'privacy/setPointVisibility'

export async function setContactPointVisibility(
  db: SupabaseClient<Database>,
  workspaceId: string,
  contactPointId: unknown,
  visibility: unknown,
): Promise<void> {
  const id = requireId('contactPointId', contactPointId)
  const value = requireVisibility(visibility)
  const updated = await db
    .from('contact_points')
    .update({ visibility: value })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .select('id')
  if (updated.error) throw stepError(MODULE, `set visibility of number ${id}`, updated.error)
  if (updated.data.length === 0) {
    throw stepError(MODULE, `set visibility of number ${id}`, `not found in workspace ${workspaceId}`)
  }
}
