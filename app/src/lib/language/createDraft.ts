/**
 * `createDraft`: rewrites an English variant with AI and stores the result as
 * a new 'ai_draft' variant pointing at its parent. Called by the createAiDraft
 * server action; takes the RLS client and an optional mock model client.
 */
import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import type { Mix, Register, Script } from '@/lib/domain'
import { stepError } from '@/lib/step-error'
import { loadExamples } from './loadExamples'
import { toMixText } from './mixText'
import { rewriteVariant } from './rewrite.server'
import { validateRewriteInput } from './validateRewriteInput'

const MODULE = 'createDraft'

export async function createDraft(
  db: SupabaseClient<Database>,
  workspaceId: string,
  variantId: string,
  mix: Mix,
  script: Script,
  register: Register,
  client?: Pick<Anthropic, 'messages'>,
): Promise<{ variantId: string }> {
  validateRewriteInput(variantId, mix, script, register)
  const parent = await db
    .from('content_variants')
    .select('kind, vertical, stage, body, company_id')
    .eq('workspace_id', workspaceId)
    .eq('id', variantId)
    .maybeSingle()
  if (parent.error) throw stepError(MODULE, `read English variant ${variantId}`, parent.error)
  if (!parent.data) throw stepError(MODULE, `read English variant ${variantId}`, `not found in workspace ${workspaceId}`)

  const examples = await loadExamples(db, workspaceId, mix, script)
  const text = await rewriteVariant({ text: parent.data.body, mix, script, register, examples }, client)

  const inserted = await db
    .from('content_variants')
    .insert({
      workspace_id: workspaceId,
      kind: parent.data.kind,
      vertical: parent.data.vertical,
      // A rewrite of one company's opener stays that company's, so it never joins generic lists.
      company_id: parent.data.company_id ?? null,
      stage: parent.data.stage,
      mix: toMixText(mix),
      script,
      register,
      body: text,
      parent_variant_id: variantId,
      source: 'ai_draft',
    })
    .select('id')
    .single()
  if (inserted.error) throw stepError(MODULE, `save draft of variant ${variantId}`, inserted.error)
  return { variantId: inserted.data.id }
}
