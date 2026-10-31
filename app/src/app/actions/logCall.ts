'use server'

/**
 * Server action that logs one call. Finds the signed-in user's workspace, then
 * hands the input to logCallInWorkspace, which validates it. Throws on failure so
 * the outbox keeps the outcome queued; retries are safe on clientId. Called by
 * useOutbox.
 */
import { revalidatePath } from 'next/cache'
import type { LogCallInput, LogCallResult } from '@/lib/call/logCallInput'
import { logCallInWorkspace } from '@/lib/call/logCallInWorkspace'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function logCall(input: LogCallInput): Promise<LogCallResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    const result = await logCallInWorkspace(db, workspaceId, input)
    revalidatePath('/leads/[id]', 'page')
    return result
  } catch (error) {
    console.error('[logCall] log call failed', error)
    throw error
  }
}
