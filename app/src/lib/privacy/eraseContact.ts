/**
 * `eraseContactData`: erases one person on request. Their numbers and contact
 * row are deleted, their activities kept but emptied, matching raw import cells
 * blanked, and an `erased` row written to consent_log - all in one transaction
 * (the erase_contact SQL function). Called by the eraseContact server action.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { requireId } from './validatePrivacyInput'

const MODULE = 'privacy/eraseContact'

export async function eraseContactData(
  db: SupabaseClient<Database>,
  workspaceId: string,
  contactId: unknown,
): Promise<void> {
  const id = requireId('contactId', contactId)
  const { error } = await db.rpc('erase_contact', { p_workspace_id: workspaceId, p_contact_id: id })
  if (error) throw stepError(MODULE, `erase contact ${id}`, error)
}
