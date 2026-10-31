/**
 * `loadLead`: everything the lead workspace page shows for one company,
 * as a LeadView. Uses the signed-in user's client, so a company of another
 * workspace is "not found". Called by getLead (the page) and the DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { resolveEntryOffer } from './entryOffer'
import { isUuid } from './isUuid'
import type { LeadView } from './leadView'
import {
  readActivities,
  readCallOutcomes,
  readContacts,
  readOpeners,
  readPoints,
  readTasks,
  readVerticalDefault,
  readWorkspaceMix,
  type LeadScope,
} from './readLeadParts'

const MODULE = 'loadLead'

/** The company does not exist, or belongs to another workspace, or the id is not a uuid. */
export class LeadNotFoundError extends Error {
  constructor(companyId: string, workspaceId: string) {
    super(`[${MODULE}] find company ${companyId} failed: not found in workspace ${workspaceId}`)
    this.name = 'LeadNotFoundError'
  }
}

export async function loadLead(
  db: SupabaseClient<Database>,
  workspaceId: string,
  companyId: string,
): Promise<LeadView> {
  if (!isUuid(companyId)) throw new LeadNotFoundError(String(companyId), workspaceId)

  const found = await db.from('companies').select('*').eq('workspace_id', workspaceId).eq('id', companyId).maybeSingle()
  if (found.error) throw stepError(MODULE, `find company ${companyId}`, found.error)
  if (!found.data) throw new LeadNotFoundError(companyId, workspaceId)
  const company = found.data

  const scope: LeadScope = { db, workspaceId, companyId, companyName: company.name }
  const [contacts, points, openers, tasks, activities, callOutcomes, workspaceMix, verticalDefault] =
    await Promise.all([
      readContacts(scope),
      readPoints(scope),
      readOpeners(scope, company.vertical),
      readTasks(scope),
      readActivities(scope),
      readCallOutcomes(scope),
      readWorkspaceMix(scope),
      readVerticalDefault(scope, company.vertical),
    ])

  const entryOffer = resolveEntryOffer(company.entry_offer, verticalDefault.entryOffer)
  return {
    company,
    entryOffer,
    entryOfferIsDefault: entryOffer !== null && !company.entry_offer?.trim(),
    longTermOpportunity: resolveEntryOffer(company.long_term_opportunity, verticalDefault.longTermOpportunity),
    contacts,
    points,
    openers,
    workspaceMix,
    tasks,
    activities,
    callOutcomes,
  }
}
