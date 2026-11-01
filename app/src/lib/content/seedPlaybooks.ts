/**
 * Writes the six starter playbooks for a workspace. Rows that already exist
 * (same service key) are left alone, so a user's edits survive. Called by
 * seedWorkspaceContent.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { SEED_PLAYBOOKS } from './seedFiles'

const MODULE = 'seedPlaybooks'

export async function seedPlaybooks(db: SupabaseClient<Database>, workspaceId: string): Promise<void> {
  const rows = SEED_PLAYBOOKS.map((playbook) => ({
    workspace_id: workspaceId,
    service_key: playbook.serviceKey,
    title: playbook.title,
    pitch: playbook.pitch,
    discovery_questions: playbook.discoveryQuestions,
    deliverables: playbook.deliverables,
    pricing_guidance: playbook.pricingGuidance,
  }))
  const result = await db.from('playbooks').upsert(rows, { onConflict: 'workspace_id,service_key', ignoreDuplicates: true })
  if (result.error) throw stepError(MODULE, `save playbooks of workspace ${workspaceId}`, result.error)
}
