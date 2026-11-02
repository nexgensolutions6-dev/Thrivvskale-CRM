'use server'

/**
 * Server action that logs one call. Finds the signed-in user's workspace, then
 * hands the input to logCallInWorkspace, which validates it. A permanent no comes
 * back as a typed refusal. Anything else throws, and so does a session redirect,
 * so the outbox keeps the outcome queued; retries are safe on clientId. Called by useOutbox.
 */
import { revalidatePath } from 'next/cache'
import type { LogCallInput, LogCallOutcome } from '@/lib/call/logCallInput'
import { logCallInWorkspace } from '@/lib/call/logCallInWorkspace'
import { refusalReason } from '@/lib/call/logCallRefusal'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function logCall(input: LogCallInput): Promise<LogCallOutcome> {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  try {
    const result = await logCallInWorkspace(db, workspaceId, input)
    revalidatePath('/leads/[id]', 'page')
    return { ok: true, ...result }
  } catch (error) {
    console.error('[logCall] log call failed', error)
    const reason = refusalReason(error)
    if (reason === null) throw error
    return { ok: false, refused: true, reason }
  }
}
