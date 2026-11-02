'use server'

/**
 * Server actions behind the AI rewrite buttons: create a draft rewrite of an
 * English variant, and approve a draft. Find the workspace, then delegate.
 */
import type { Mix, Register, Script } from '@/lib/domain'
import { approveDraftVariant } from '@/lib/language/approveDraftVariant'
import { createDraft } from '@/lib/language/createDraft'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function createAiDraft(
  variantId: string,
  mix: Mix,
  script: Script,
  register: Register,
): Promise<{ variantId: string }> {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  return createDraft(db, workspaceId, variantId, mix, script, register)
}

export async function approveDraft(variantId: string): Promise<void> {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  await approveDraftVariant(db, workspaceId, variantId)
}
