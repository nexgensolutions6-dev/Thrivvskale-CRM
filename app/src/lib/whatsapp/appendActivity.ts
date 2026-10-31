/**
 * `appendActivity`: adds one row to a company's activity timeline. Used by
 * confirmWhatsAppForPoint now; later tasks (calls, notes) can reuse it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'

type ActivityInsert = Database['public']['Tables']['activities']['Insert']

export interface NewActivity {
  workspaceId: string
  companyId: string
  contactPointId: string | null
  type: ActivityInsert['type']
  body: string
  metadata?: Record<string, string>
}

export async function appendActivity(db: SupabaseClient<Database>, activity: NewActivity): Promise<void> {
  const { error } = await db.from('activities').insert({
    workspace_id: activity.workspaceId,
    company_id: activity.companyId,
    contact_point_id: activity.contactPointId,
    type: activity.type,
    body: activity.body,
    metadata: activity.metadata ?? {},
  })
  if (error) {
    throw stepError('appendActivity', `insert activity (contactPointId ${activity.contactPointId})`, error)
  }
}
