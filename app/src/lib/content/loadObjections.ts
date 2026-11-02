/**
 * Reads the workspace's objections with every stored response to each (the
 * English original and any rewrites), for the call card's objection drawer.
 * Uses the user's client, so RLS applies. Called by loadCallScreen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CallObjection, ObjectionResponse } from '@/lib/call/callScreen'
import type { Database } from '@/lib/db/types'
import { parseMixText } from '@/lib/leads/contactMix'
import { stepError } from '@/lib/step-error'

const MODULE = 'loadObjections'
const MAX_OBJECTIONS = 200
const VARIANT_COLUMNS = 'id, kind, mix, script, register, body, parent_variant_id, source'

type Db = SupabaseClient<Database>
type VariantRow = Pick<
  Database['public']['Tables']['content_variants']['Row'],
  'id' | 'mix' | 'script' | 'register' | 'body' | 'parent_variant_id' | 'source'
>

function toResponse(row: VariantRow): ObjectionResponse {
  return {
    isDraft: row.source === 'ai_draft',
    variant: {
      id: row.id,
      kind: 'objection_response',
      mix: parseMixText(row.mix),
      script: row.script,
      register: row.register ?? 'formal',
      body: row.body,
      parentVariantId: row.parent_variant_id,
    },
  }
}

async function readResponses(db: Db, workspaceId: string, englishIds: string[]): Promise<VariantRow[]> {
  if (englishIds.length === 0) return []
  const list = englishIds.join(',')
  const result = await db.from('content_variants').select(VARIANT_COLUMNS)
    .eq('workspace_id', workspaceId).eq('kind', 'objection_response')
    .or(`id.in.(${list}),parent_variant_id.in.(${list})`)
  if (result.error) throw stepError(MODULE, 'read objection responses', result.error)
  return result.data
}

export async function loadObjections(db: Db, workspaceId: string): Promise<CallObjection[]> {
  const objections = await db.from('objections').select('id, text, suggested_response_id')
    .eq('workspace_id', workspaceId).order('text').limit(MAX_OBJECTIONS)
  if (objections.error) throw stepError(MODULE, 'read objections', objections.error)

  const englishIds = objections.data.flatMap((row) => (row.suggested_response_id ? [row.suggested_response_id] : []))
  const rows = await readResponses(db, workspaceId, englishIds)

  return objections.data.map((objection) => {
    const englishId = objection.suggested_response_id
    const mine = rows.filter((row) => englishId !== null && (row.id === englishId || row.parent_variant_id === englishId))
    return { id: objection.id, text: objection.text, englishId, responses: mine.map(toResponse) }
  })
}
