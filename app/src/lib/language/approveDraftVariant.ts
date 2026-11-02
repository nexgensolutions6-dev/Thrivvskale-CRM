/**
 * `approveDraftVariant`: flips an 'ai_draft' variant to 'ai_approved' so it
 * becomes a few-shot example. Called by the approveDraft server action.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'

const MODULE = 'approveDraftVariant'

export async function approveDraftVariant(
  db: SupabaseClient<Database>,
  workspaceId: string,
  variantId: string,
): Promise<void> {
  const updated = await db
    .from('content_variants')
    .update({ source: 'ai_approved', updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', variantId)
    .eq('source', 'ai_draft')
    .select('id')
  if (updated.error) throw stepError(MODULE, `approve variant ${variantId}`, updated.error)
  if (!updated.data || updated.data.length === 0) {
    throw stepError(MODULE, `approve variant ${variantId}`, `no ai_draft with that id in workspace ${workspaceId}`)
  }
}
