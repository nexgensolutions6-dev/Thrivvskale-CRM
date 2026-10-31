/**
 * `saveVoiceNote`: stores the audio in the private voice-notes bucket at
 * <workspaceId>/<activityId>.webm, then adds the voice_note activity. No
 * transcript is needed. Uses the user's client, so row-level security applies.
 * Called by the recordVoiceNote server action and the DB tests.
 */
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { requireCompany } from '@/lib/leads/requireCompany'
import { stepError } from '@/lib/step-error'
import { validateVoiceNote } from './validateVoiceNote'

const MODULE = 'saveVoiceNote'
const BUCKET = 'voice-notes'
const STORED_TYPE = 'audio/webm'

export async function saveVoiceNote(
  db: SupabaseClient<Database>,
  workspaceId: string,
  companyId: unknown,
  audio: unknown,
): Promise<{ activityId: string }> {
  const upload = await validateVoiceNote(companyId, audio)
  const company = await requireCompany(db, MODULE, workspaceId, upload.companyId)

  const activityId = randomUUID()
  const storagePath = `${workspaceId}/${activityId}.webm`
  const stored = await db.storage.from(BUCKET).upload(storagePath, upload.bytes, { contentType: STORED_TYPE })
  if (stored.error) throw stepError(MODULE, `store audio for "${company.name}"`, stored.error)

  const activity = await db.from('activities').insert({
    id: activityId,
    workspace_id: workspaceId,
    company_id: company.id,
    type: 'voice_note',
    body: 'Voice note',
    metadata: { storagePath, sizeBytes: upload.bytes.length },
  })
  if (activity.error) {
    await removeOrphanAudio(db, storagePath, company.name)
    throw stepError(MODULE, `add voice note activity for "${company.name}"`, activity.error)
  }
  return { activityId }
}

/** Best effort: the insert error is the one that matters, so a failed clean-up is only logged. */
async function removeOrphanAudio(db: SupabaseClient<Database>, path: string, companyName: string): Promise<void> {
  const removed = await db.storage.from(BUCKET).remove([path])
  if (removed.error) {
    console.error(`[${MODULE}] remove orphan audio ${path} for "${companyName}" failed: ${removed.error.message}`)
  }
}
