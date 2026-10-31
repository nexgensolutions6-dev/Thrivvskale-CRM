/**
 * `loadExamples`: the 5 newest approved rewrites for a mix + script, each
 * paired with its English original. Called by createDraft.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import type { Mix, Script } from '@/lib/domain'
import { stepError } from '@/lib/step-error'
import type { RewriteExample } from './buildRewritePrompt'
import { toMixText } from './mixText'

const MODULE = 'loadExamples'
const EXAMPLE_COUNT = 5

export async function loadExamples(
  db: SupabaseClient<Database>,
  workspaceId: string,
  mix: Mix,
  script: Script,
): Promise<RewriteExample[]> {
  const approved = await db
    .from('content_variants')
    .select('body, parent_variant_id')
    .eq('workspace_id', workspaceId)
    .eq('source', 'ai_approved')
    .eq('mix', toMixText(mix))
    .eq('script', script)
    .not('parent_variant_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(EXAMPLE_COUNT)
  if (approved.error) throw stepError(MODULE, 'read approved variants', approved.error)
  const rows = approved.data ?? []
  if (rows.length === 0) return []

  const parentIds = rows.map((row) => row.parent_variant_id as string)
  const parents = await db
    .from('content_variants')
    .select('id, body')
    .eq('workspace_id', workspaceId)
    .in('id', parentIds)
  if (parents.error) throw stepError(MODULE, 'read English originals', parents.error)
  const englishById = new Map((parents.data ?? []).map((parent) => [parent.id, parent.body]))

  return rows.flatMap((row) => {
    const from = englishById.get(row.parent_variant_id as string)
    return from ? [{ from, to: row.body }] : []
  })
}
