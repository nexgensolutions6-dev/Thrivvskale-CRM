'use server'

/**
 * Server action behind the "Re-check website" button. Finds the signed-in
 * user's workspace, then hands the work to recheckSiteForCompany, which does
 * the safe fetch. Throws (with module and step in the message) on failure.
 */
import { revalidatePath } from 'next/cache'
import { recheckSiteForCompany } from '@/lib/site-check/recheckSiteForCompany'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function recheckSite(companyId: string): Promise<{ websiteStatus: string }> {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  const result = await recheckSiteForCompany(db, workspaceId, companyId)
  revalidatePath(`/leads/${companyId}`)
  return result
}
