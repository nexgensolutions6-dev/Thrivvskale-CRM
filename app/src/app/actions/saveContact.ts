'use server'

/**
 * Server action behind the contact form on the lead page (add or edit a
 * person, with name_latin and role). Finds the signed-in user's workspace,
 * then hands the input to saveContact, which validates it. Returns ok or a
 * message for the form.
 */
import { revalidatePath } from 'next/cache'
import { failureResult, type ActionResult } from '@/lib/leads/actionResult'
import { saveContact } from '@/lib/leads/saveContact'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function saveContactAction(input: unknown): Promise<ActionResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    await saveContact(db, workspaceId, input)
    revalidatePath('/leads/[id]', 'page')
    return { ok: true }
  } catch (error) {
    return failureResult('saveContactAction', error)
  }
}
