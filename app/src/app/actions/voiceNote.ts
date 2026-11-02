'use server'

/**
 * Server action behind the voice-note button. Finds the signed-in user's
 * workspace, then hands the audio to saveVoiceNote, which validates and stores
 * it. Never queued offline. Called by VoiceNoteButton.
 */
import { revalidatePath } from 'next/cache'
import { saveVoiceNote } from '@/lib/call/saveVoiceNote'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function recordVoiceNote(companyId: string, audio: Blob): Promise<{ activityId: string }> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    const result = await saveVoiceNote(db, workspaceId, companyId, audio)
    revalidatePath('/leads/[id]', 'page')
    return result
  } catch (error) {
    console.error('[recordVoiceNote] save voice note failed', error)
    throw error
  }
}
