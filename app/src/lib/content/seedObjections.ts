/**
 * Writes the five starter objections, each with its English response. The
 * response is a content_variant (kind 'objection_response'); the objection
 * points at it. Existing rows (same seed key) are left alone. Called by
 * seedWorkspaceContent.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { SEED_OBJECTIONS } from './seedFiles'

const MODULE = 'seedObjections'
const CONFLICT = 'workspace_id,seed_key'

type Db = SupabaseClient<Database>

async function saveResponses(db: Db, workspaceId: string): Promise<Map<string, string>> {
  const rows = SEED_OBJECTIONS.map((objection) => ({
    workspace_id: workspaceId,
    kind: 'objection_response' as const,
    seed_key: `objection:${objection.key}`,
    mix: 'en',
    script: 'latin' as const,
    register: 'formal' as const,
    body: objection.response,
  }))
  const saved = await db.from('content_variants').upsert(rows, { onConflict: CONFLICT, ignoreDuplicates: true })
  if (saved.error) throw stepError(MODULE, `save objection responses of workspace ${workspaceId}`, saved.error)

  const read = await db.from('content_variants').select('id, seed_key')
    .eq('workspace_id', workspaceId).in('seed_key', rows.map((row) => row.seed_key))
  if (read.error) throw stepError(MODULE, `read objection responses of workspace ${workspaceId}`, read.error)
  return new Map(read.data.map((row) => [row.seed_key as string, row.id]))
}

export async function seedObjections(db: Db, workspaceId: string): Promise<void> {
  const responseIds = await saveResponses(db, workspaceId)
  const rows = SEED_OBJECTIONS.map((objection) => ({
    workspace_id: workspaceId,
    seed_key: `objection:${objection.key}`,
    text: objection.text,
    suggested_response_id: responseIds.get(`objection:${objection.key}`) ?? null,
  }))
  const saved = await db.from('objections').upsert(rows, { onConflict: CONFLICT, ignoreDuplicates: true })
  if (saved.error) throw stepError(MODULE, `save objections of workspace ${workspaceId}`, saved.error)
}
