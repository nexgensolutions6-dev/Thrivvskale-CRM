'use server'

/**
 * Server action behind the notes box on the lead page. Finds the signed-in
 * user's workspace, then hands the text to addNoteToCompany, which validates
 * it. Returns ok or a message for the form.
 */
import { revalidatePath } from 'next/cache'
import { addNoteToCompany } from '@/lib/leads/addNote'
import { failureResult, type ActionResult } from '@/lib/leads/actionResult'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function addNote(companyId: unknown, body: unknown): Promise<ActionResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    await addNoteToCompany(db, workspaceId, companyId, body)
    revalidatePath('/leads/[id]', 'page')
    return { ok: true }
  } catch (error) {
    return failureResult('addNote', error)
  }
}
