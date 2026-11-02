/**
 * `recheckSiteForCompany`: re-checks a company's website and saves the result
 * (Own site - loads / failed to load in check). When the status changes it
 * logs a site_recheck activity, and when a failed site now loads it drops the
 * "Broken/wrong website" intent signal. Called by the recheckSite server
 * action; takes the signed-in user's client, so row-level security applies.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { isPlatformUrl } from '@/lib/import/platformDomains'
import { isUuid } from '@/lib/leads/isUuid'
import { stepError } from '@/lib/step-error'
import { appendActivity } from '@/lib/whatsapp/appendActivity'
import { nextIntentSignal } from './nextIntentSignal'
import { probeSite, type ProbeDeps } from './probeSite'
import { SITE_FAILED, SITE_LOADS } from './websiteStatus'

const MODULE = 'recheckSiteForCompany'

export async function recheckSiteForCompany(
  db: SupabaseClient<Database>,
  workspaceId: string,
  companyId: string,
  deps: ProbeDeps = {},
): Promise<{ websiteStatus: string }> {
  if (!isUuid(companyId)) {
    throw stepError(MODULE, 'validate input', `companyId must be a uuid string, got ${JSON.stringify(companyId)}`)
  }

  const found = await db
    .from('companies')
    .select('id, name, website_url, website_status, intent_signal')
    .eq('workspace_id', workspaceId)
    .eq('id', companyId)
    .maybeSingle()
  if (found.error) throw stepError(MODULE, `find company ${companyId}`, found.error)
  if (!found.data) throw stepError(MODULE, `find company ${companyId}`, `not found in workspace ${workspaceId}`)
  const company = found.data

  const step = `check website of "${company.name}"`
  if (!company.website_url) throw stepError(MODULE, step, 'company has no website address')
  if (isPlatformUrl(company.website_url)) {
    const detail = `${company.website_url} is not a business's own website (directory, social or builder page)`
    throw stepError(MODULE, step, detail)
  }

  let probe
  try {
    probe = await probeSite(company.website_url, deps)
  } catch (error) {
    throw stepError(MODULE, step, error) // includes UnsafeUrlError: nothing was fetched
  }

  const websiteStatus = probe.loads ? SITE_LOADS : SITE_FAILED
  const previous = company.website_status
  if (websiteStatus === previous) return { websiteStatus }

  const updated = await db
    .from('companies')
    .update({
      website_status: websiteStatus,
      intent_signal: nextIntentSignal(company.intent_signal, previous, websiteStatus),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', companyId)
  if (updated.error) throw stepError(MODULE, `save website status of "${company.name}"`, updated.error)

  await appendActivity(db, {
    workspaceId,
    companyId,
    contactPointId: null,
    type: 'site_recheck',
    body: `Website re-checked: ${previous ?? 'no status'} -> ${websiteStatus} (${probe.detail})`,
    metadata: { event: 'site_recheck', from: previous ?? '', to: websiteStatus, detail: probe.detail },
  })
  return { websiteStatus }
}
