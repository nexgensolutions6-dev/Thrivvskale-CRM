/**
 * The counts shown after an import (and, before it, as the preview). Built by
 * buildReport from an ImportPlan; used by importLeads, previewImport and the
 * Import screen.
 */
import type { ImportPlan } from '@/lib/import/importPlan'

export interface ImportReport {
  inserted: number
  updated: number
  needsNumber: number
  websiteInvalid: number
  /** Leads whose WhatsApp cell was a link, not a number (kept in the raw row). */
  unparsedWhatsapp: number
}

export function buildReport(plan: ImportPlan): ImportReport {
  const leads = plan.entries.map((entry) => entry.lead)
  return {
    inserted: plan.entries.filter((entry) => entry.isNew).length,
    updated: plan.entries.filter((entry) => !entry.isNew).length,
    needsNumber: leads.filter((lead) => lead.needsNumber).length,
    websiteInvalid: leads.filter((lead) => lead.company.websiteInvalid).length,
    unparsedWhatsapp: leads.filter((lead) => lead.unparsedWhatsapp !== null).length,
  }
}
