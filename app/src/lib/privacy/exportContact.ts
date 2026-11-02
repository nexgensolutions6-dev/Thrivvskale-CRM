/**
 * `exportContactData`: hands back, as JSON, everything held about one person
 * (see readContactExport) and writes an `exported` row to consent_log. The
 * export is only returned once the log row is written. Called by the
 * exportContact server action and the DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { readContactExport, type ContactExport } from './readContactExport'
import { requireId } from './validatePrivacyInput'

const MODULE = 'privacy/exportContact'

export async function exportContactData(
  db: SupabaseClient<Database>,
  workspaceId: string,
  contactId: unknown,
): Promise<ContactExport> {
  const id = requireId('contactId', contactId)
  const data = await readContactExport(db, workspaceId, id)
  const logged = await db.from('consent_log').insert({
    workspace_id: workspaceId,
    company_id: data.contact.company_id,
    contact_id: id,
    event: 'exported',
  })
  if (logged.error) throw stepError(MODULE, `log export of contact ${id}`, logged.error)
  return data
}
