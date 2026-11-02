/**
 * Turns a planned lead into the database row for its company. Called by
 * writeCompanies. A new company gets every column; an update row leaves out
 * what people change in the app after the first import (stage, tags,
 * needs_number), so a re-import never overwrites their work.
 */
import type { Database } from '@/lib/db/types'
import type { PlannedLead } from '@/lib/import/importPlan'
import type { DefaultOffers } from '@/lib/import/verticalDefaults'

type CompanyInsert = Database['public']['Tables']['companies']['Insert']

/** The columns a CSV row may set on both new and existing companies. */
export function toImportedFields(entry: PlannedLead, workspaceId: string, defaults: DefaultOffers) {
  const { company } = entry.lead
  const offerIsDefault = company.entryOffer === defaults.get(company.vertical)
  return {
    id: entry.companyId,
    workspace_id: workspaceId,
    name: company.name,
    vertical: company.vertical,
    tier: company.tier,
    area: company.area,
    city: company.city,
    state: company.state,
    country: company.country,
    website_url: company.websiteUrl,
    website_status: company.websiteStatus,
    website_invalid: company.websiteInvalid,
    google_rating: company.googleRating,
    google_reviews: company.googleReviews,
    source: company.source,
    priority: company.priority,
    base_score: company.baseScore,
    intent_signal: company.intentSignal,
    problem_evidence: company.problemEvidence,
    entry_offer: offerIsDefault ? null : company.entryOffer,
    long_term_opportunity: company.longTermOpportunity,
  } satisfies CompanyInsert
}

export function toNewCompanyRow(
  entry: PlannedLead,
  workspaceId: string,
  defaults: DefaultOffers,
): CompanyInsert {
  return {
    ...toImportedFields(entry, workspaceId, defaults),
    stage: entry.lead.company.stage,
    needs_number: entry.lead.needsNumber,
    tags: entry.lead.tags,
  }
}
