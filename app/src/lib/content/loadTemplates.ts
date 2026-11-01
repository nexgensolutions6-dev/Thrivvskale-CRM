/**
 * Reads the workspace's WhatsApp templates (generic ones, not tied to a company)
 * grouped as one entry per English template with its rewrites. Uses the user's
 * client, so RLS applies. Called by loadCallScreen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CallTemplate } from '@/lib/call/callScreen'
import type { Database } from '@/lib/db/types'
import { parseMixText } from '@/lib/leads/contactMix'
import { stepError } from '@/lib/step-error'
import { groupTemplates } from './groupTemplates'

const MODULE = 'loadTemplates'
const MAX_TEMPLATES = 200

export async function loadTemplates(db: SupabaseClient<Database>, workspaceId: string): Promise<CallTemplate[]> {
  const result = await db.from('content_variants')
    .select('id, title, mix, script, register, body, parent_variant_id')
    .eq('workspace_id', workspaceId).eq('kind', 'template').is('company_id', null)
    .order('created_at').limit(MAX_TEMPLATES)
  if (result.error) throw stepError(MODULE, 'read templates', result.error)

  return groupTemplates(result.data.map((row) => ({
    id: row.id,
    kind: 'template' as const,
    title: row.title,
    mix: parseMixText(row.mix),
    script: row.script,
    register: row.register ?? 'formal',
    body: row.body,
    parentVariantId: row.parent_variant_id,
  })))
}
