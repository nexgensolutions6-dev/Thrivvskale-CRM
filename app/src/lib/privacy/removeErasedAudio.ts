/**
 * `removeErasedAudio`: after erase_contact has run, deletes the voice-note
 * audio files of the erased person's activities from the voice-notes bucket,
 * one file at a time, and only inside the workspace's own folder. A failure is
 * logged by storage path (workspace and activity ids only) and returned, never
 * thrown. Called by eraseContactData.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { isWorkspaceAudioPath } from './isWorkspaceAudioPath'

const MODULE = 'privacy/removeErasedAudio'
const BUCKET = 'voice-notes'

/** Deletes one file; returns why it is still there, or null when it went. */
async function removeOne(db: SupabaseClient<Database>, workspaceId: string, path: string): Promise<string | null> {
  if (!isWorkspaceAudioPath(workspaceId, path)) return `path is outside workspace ${workspaceId}, not touched`
  const removed = await db.storage.from(BUCKET).remove([path])
  if (removed.error) return removed.error.message
  // Storage reports no error when RLS hides the file or it is missing, only an empty list.
  if (removed.data?.length !== 1) return 'nothing was deleted (file missing or not allowed)'
  return null
}

/** Returns the storage paths that could not be removed (empty when all went). */
export async function removeErasedAudio(
  db: SupabaseClient<Database>,
  workspaceId: string,
  contactId: string,
  paths: string[],
): Promise<string[]> {
  const failed: string[] = []
  for (const path of paths) {
    const reason = await removeOne(db, workspaceId, path)
    if (reason) {
      console.error(`[${MODULE}] remove audio ${path} of erased contact ${contactId} failed: ${reason}`)
      failed.push(path)
    }
  }
  return failed
}
