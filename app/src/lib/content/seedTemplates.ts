/**
 * Writes the four English WhatsApp follow-up templates (content_variants of
 * kind 'template') for a workspace. Existing ones (same seed key) are left
 * alone. Called by seedWorkspaceContent.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { SEED_TEMPLATES } from './seedFiles'

const MODULE = 'seedTemplates'

export async function seedTemplates(db: SupabaseClient<Database>, workspaceId: string): Promise<void> {
  const rows = SEED_TEMPLATES.map((template) => ({
    workspace_id: workspaceId,
    kind: 'template' as const,
    seed_key: `template:${template.key}`,
    title: template.title,
    mix: 'en',
    script: 'latin' as const,
    register: 'formal' as const,
    body: template.body,
  }))
  const result = await db.from('content_variants').upsert(rows, { onConflict: 'workspace_id,seed_key', ignoreDuplicates: true })
  if (result.error) throw stepError(MODULE, `save templates of workspace ${workspaceId}`, result.error)
}
