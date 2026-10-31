/**
 * Turns one parsed row of the lead CSV into a MappedLead. Called by the
 * import runner (Task 6) for every row from parseLeadsCsv.
 *
 * buildMappedLead below is a table: each line reads "field <- helper", and
 * the helper's file holds the rule for that one field. A failing field throws
 * from its helper; mapLeadRow adds the company name so the bad row is easy to find.
 */
import type { Priority, Tier } from '@/lib/domain'
import { tierForVertical } from '@/lib/domain'
import { readRequiredText, readText, readTextOrNull, type CsvRow } from '@/lib/import/cell'
import { parsePriority } from '@/lib/import/leadPriority'
import { readNumber, readOptionalNumber } from '@/lib/import/parseNumber'
import { buildPhonePoints, type LeadPoint } from '@/lib/import/phonePoints'
import { splitTags } from '@/lib/import/tags'
import { findUnparsedWhatsapp } from '@/lib/import/unparsedWhatsapp'
import { parseWaStatus } from '@/lib/import/waStatus'
import { isWebsiteInvalid } from '@/lib/import/websiteValidity'
import { stepError } from '@/lib/step-error'

export interface MappedCompany {
  name: string
  vertical: string
  tier: Tier
  area: string
  city: string
  state: string
  websiteUrl: string | null
  websiteStatus: string
  websiteInvalid: boolean
  googleRating: number | null
  googleReviews: number | null
  source: string
  priority: Priority
  baseScore: number
  intentSignal: string | null
  problemEvidence: string | null
  entryOffer: string | null
  longTermOpportunity: string | null
  stage: string
}

export interface MappedLead {
  company: MappedCompany
  points: LeadPoint[]
  tags: string[]
  opener: string | null
  needsNumber: boolean
  /** Raw WhatsApp (verified) cell when it is not a phone number (a wa.me link), else null. */
  unparsedWhatsapp: string | null
}

const MODULE = 'mapLeadRow'

export function mapLeadRow(row: CsvRow): MappedLead {
  try {
    return buildMappedLead(row)
  } catch (error) {
    const company = readText(row, 'Company Name') || '(no company name)'
    throw stepError(MODULE, `map row "${company}"`, error)
  }
}

function buildMappedLead(row: CsvRow): MappedLead {
  const vertical = readText(row, 'Industry')
  const websiteUrl = readTextOrNull(row, 'Website')
  const whatsappCell = readText(row, 'WhatsApp (verified)')
  const waStatus = parseWaStatus(readText(row, 'WhatsApp Status'))
  const points = buildPhonePoints(readText(row, 'Phone'), whatsappCell, waStatus)

  return {
    company: {
      name: readRequiredText(row, 'Company Name'),
      vertical,
      tier: tierForVertical(vertical),
      area: readText(row, 'Area'),
      city: readText(row, 'City'),
      state: readText(row, 'State'),
      websiteUrl,
      websiteStatus: readText(row, 'Website Status'),
      websiteInvalid: isWebsiteInvalid(websiteUrl),
      googleRating: readOptionalNumber(row, 'Google Rating'),
      googleReviews: readOptionalNumber(row, 'Google Reviews'),
      source: readText(row, 'Lead Source'),
      priority: parsePriority(readText(row, 'Priority')),
      baseScore: readNumber(row, 'Lead Score'),
      intentSignal: readTextOrNull(row, 'High Intent Signal'),
      problemEvidence: readTextOrNull(row, 'Problem / Evidence'),
      entryOffer: readTextOrNull(row, 'Entry Offer'),
      longTermOpportunity: readTextOrNull(row, 'Long-term Opportunity'),
      stage: readText(row, 'Lead Status'),
    },
    points,
    tags: splitTags(readText(row, 'Tags')),
    opener: readTextOrNull(row, 'Call Opener'),
    needsNumber: points.length === 0, // no usable number: Task 6 makes a "find number" task
    unparsedWhatsapp: findUnparsedWhatsapp(whatsappCell),
  }
}
