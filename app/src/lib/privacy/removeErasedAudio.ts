/**
 * `removeErasedAudio`: after erase_contact has run, deletes the voice-note
 * audio files of the erased person's activities from the voice-notes bucket,
 * one file at a time. A failure is logged by storage path (workspace and
 * activity ids only) and returned, never thrown. Called by eraseContactData.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

const MODULE = 'privacy/removeErasedAudio'
const BUCKET = 'voice-notes'

/** Returns the storage paths that could not be removed (empty when all went). */
export async function removeErasedAudio(
  db: SupabaseClient<Database>,
  contactId: string,
  paths: string[],
): Promise<string[]> {
  const failed: string[] = []
  for (const path of paths) {
    const removed = await db.storage.from(BUCKET).remove([path])
    if (removed.error) {
      console.error(`[${MODULE}] remove audio ${path} of erased contact ${contactId} failed: ${removed.error.message}`)
      failed.push(path)
    }
  }
  return failed
}
