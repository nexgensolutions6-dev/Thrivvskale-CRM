/**
 * `addNoteToCompany`: saves a free-text note on a lead's timeline (an
 * activity of type note). Called by the addNote server action; takes the
 * signed-in user's client, so row-level security applies.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { appendActivity } from '@/lib/whatsapp/appendActivity'
import { requireCompany } from './requireCompany'
import { validateNoteInput } from './validateNoteInput'

const MODULE = 'addNote'

export async function addNoteToCompany(
  db: SupabaseClient<Database>,
  workspaceId: string,
  companyId: unknown,
  body: unknown,
): Promise<void> {
  const note = validateNoteInput(companyId, body)
  await requireCompany(db, MODULE, workspaceId, note.companyId)
  await appendActivity(db, {
    workspaceId,
    companyId: note.companyId,
    contactPointId: null,
    type: 'note',
    body: note.body,
    metadata: { event: 'note' },
  })
}
