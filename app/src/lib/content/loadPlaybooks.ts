/**
 * Reads the workspace's playbooks for the /more/playbooks page, sorted by
 * title. Uses the user's client, so RLS applies. Called by that page and the
 * DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'

const MODULE = 'loadPlaybooks'

export interface Playbook {
  id: string
  serviceKey: string
  title: string
  pitch: string
  discoveryQuestions: string[]
  deliverables: string[]
  pricingGuidance: string
}

function textList(value: unknown, field: string, playbookId: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw stepError(MODULE, `read ${field} of playbook ${playbookId}`, `expected a list of text, got ${JSON.stringify(value)}`)
  }
  return value as string[]
}

export async function loadPlaybooks(db: SupabaseClient<Database>, workspaceId: string): Promise<Playbook[]> {
  const result = await db.from('playbooks').select('*').eq('workspace_id', workspaceId).order('title')
  if (result.error) throw stepError(MODULE, `read playbooks of workspace ${workspaceId}`, result.error)
  return result.data.map((row) => ({
    id: row.id,
    serviceKey: row.service_key,
    title: row.title,
    pitch: row.pitch,
    discoveryQuestions: textList(row.discovery_questions, 'discovery_questions', row.id),
    deliverables: textList(row.deliverables, 'deliverables', row.id),
    pricingGuidance: row.pricing_guidance,
  }))
}
