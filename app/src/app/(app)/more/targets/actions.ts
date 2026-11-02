'use server'

/**
 * Server action for the Targets form: who is signed in, validate the numbers,
 * save them, refresh the screens that show them. Anything unexpected is logged
 * with its module and step; the person only sees a plain sentence. Called by
 * targets-form.tsx.
 */
import { revalidatePath } from 'next/cache'
import { saveTargets } from '@/lib/scoreboard/saveTargets'
import { TargetsInputError } from '@/lib/scoreboard/validateTargets'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'
import type { TargetsFormState } from './targets-result'

const GENERIC_MESSAGE = 'Your targets could not be saved. Please try again.'

export async function saveTargetsAction(_previous: TargetsFormState, form: FormData): Promise<TargetsFormState> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    const values = {
      calls: form.get('calls'),
      conversations: form.get('conversations'),
      demos: form.get('demos'),
    }
    await saveTargets(db, workspaceId, values, new Date())
  } catch (error) {
    if (error instanceof TargetsInputError) return { status: 'error', message: error.message }
    console.error('[saveTargetsAction] save targets failed:', error)
    return { status: 'error', message: GENERIC_MESSAGE }
  }
  // The menu bar chip lives in the layout, so refresh the whole tree.
  revalidatePath('/', 'layout')
  return { status: 'saved' }
}
