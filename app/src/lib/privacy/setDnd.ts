/**
 * `setCompanyDnd`: turns do-not-disturb on or off for a company and logs
 * opted_out / consented in consent_log, in one transaction (the
 * set_company_dnd SQL function). A DND company drops out of rankQueue.
 * Called by the setDnd server action and the DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { optionalNote, requireDnd, requireId } from './validatePrivacyInput'

const MODULE = 'privacy/setDnd'

export async function setCompanyDnd(
  db: SupabaseClient<Database>,
  workspaceId: string,
  companyId: unknown,
  dnd: unknown,
  note?: unknown,
): Promise<void> {
  const id = requireId('companyId', companyId)
  const flag = requireDnd(dnd)
  const reason = optionalNote(note)
  const { error } = await db.rpc('set_company_dnd', {
    p_workspace_id: workspaceId,
    p_company_id: id,
    p_dnd: flag,
    ...(reason === null ? {} : { p_note: reason }),
  })
  if (error) throw stepError(MODULE, `set dnd=${flag} on company ${id}`, error)
}
