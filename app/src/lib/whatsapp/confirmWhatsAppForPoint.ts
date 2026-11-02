/**
 * `confirmWhatsAppForPoint`: records whether a number really has WhatsApp
 * (verified or none) and logs it on the company timeline. Called by the
 * confirmWhatsApp server action; takes the RLS client so it is testable.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { appendActivity } from './appendActivity'
import { validateConfirmInput } from './validateConfirmInput'

const MODULE = 'confirmWhatsAppForPoint'

export async function confirmWhatsAppForPoint(
  db: SupabaseClient<Database>,
  workspaceId: string,
  contactPointId: string,
  hasWhatsApp: boolean,
): Promise<void> {
  validateConfirmInput(contactPointId, hasWhatsApp)
  const found = await db
    .from('contact_points')
    .select('id, company_id, e164')
    .eq('workspace_id', workspaceId)
    .eq('id', contactPointId)
    .maybeSingle()
  if (found.error) throw stepError(MODULE, `find contact point ${contactPointId}`, found.error)
  if (!found.data) {
    throw stepError(MODULE, `find contact point ${contactPointId}`, `not found in workspace ${workspaceId}`)
  }

  const waStatus = hasWhatsApp ? 'verified' : 'none'
  const updated = await db
    .from('contact_points')
    .update({ wa_status: waStatus })
    .eq('workspace_id', workspaceId)
    .eq('id', contactPointId)
  if (updated.error) throw stepError(MODULE, `set wa_status ${waStatus} on ${contactPointId}`, updated.error)

  await appendActivity(db, {
    workspaceId,
    companyId: found.data.company_id,
    contactPointId,
    type: 'note',
    body: hasWhatsApp
      ? `Confirmed ${found.data.e164} has WhatsApp`
      : `Confirmed ${found.data.e164} does not have WhatsApp`,
    metadata: { event: 'whatsapp_confirmation', waStatus },
  })
}
