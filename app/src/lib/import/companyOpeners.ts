/**
 * Picks the call opener each company of an import should store: the last
 * non-blank CSV "Call Opener" of the rows that became that company (a later
 * row wins, like the company update). Blank openers are left out, so they
 * write nothing. Pure. Called by writeOpeners.
 */
import type { ImportPlan } from '@/lib/import/importPlan'
import { stepError } from '@/lib/step-error'

const MODULE = 'companyOpeners'
const MAX_OPENER_LENGTH = 2000

export interface CompanyOpener {
  companyId: string
  companyName: string
  body: string
}

export function collectCompanyOpeners(plan: ImportPlan): CompanyOpener[] {
  const byCompany = new Map<string, CompanyOpener>()
  for (const { lead, companyId } of plan.entries) {
    const body = checkedBody(lead.opener, lead.company.name)
    if (body !== null) byCompany.set(companyId, { companyId, companyName: lead.company.name, body })
  }
  return [...byCompany.values()]
}

function checkedBody(opener: unknown, companyName: string): string | null {
  if (opener === null || opener === undefined) return null
  if (typeof opener !== 'string') {
    throw stepError(MODULE, `read the opener of "${companyName}"`, `expected text, got ${typeof opener}`)
  }
  const body = opener.trim()
  if (body === '') return null
  if (body.length > MAX_OPENER_LENGTH) {
    const reason = `opener is ${body.length} characters, the limit is ${MAX_OPENER_LENGTH}`
    throw stepError(MODULE, `read the opener of "${companyName}"`, reason)
  }
  return body
}
