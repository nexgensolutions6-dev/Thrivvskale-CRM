'use server'

/**
 * Server action behind the "Has WhatsApp? Yes / No" buttons. Finds the signed-in
 * user's workspace, then hands the work to confirmWhatsAppForPoint.
 */
import { confirmWhatsAppForPoint } from '@/lib/whatsapp/confirmWhatsAppForPoint'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function confirmWhatsApp(contactPointId: string, hasWhatsApp: boolean): Promise<void> {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  await confirmWhatsAppForPoint(db, workspaceId, contactPointId, hasWhatsApp)
}
