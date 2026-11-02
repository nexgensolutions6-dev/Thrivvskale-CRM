/**
 * Reads the workspace's existing companies into a CompanyIndex, in a few
 * requests rather than one per lead. Called by importPlan.
 * Phones are looked up only for the numbers in the file; domains and names
 * need every company, read a page at a time (the API caps a page at 1000).
 */
import { inChunks } from '@/lib/import/chunks'
import { addDomain, addNameAndCity, emptyIndex, matchableDomain, type CompanyIndex } from '@/lib/import/companyIndex'
import type { ImportDb } from '@/lib/import/importDb'
import type { MappedLead } from '@/lib/import/mapLeadRow'
import { stepError } from '@/lib/step-error'

const MODULE = 'loadCompanyIndex'
const PAGE_SIZE = 1000

export async function loadCompanyIndex(
  db: ImportDb,
  workspaceId: string,
  leads: MappedLead[],
): Promise<CompanyIndex> {
  const index = emptyIndex()
  await loadPhones(db, workspaceId, leads, index)
  await loadNamesAndDomains(db, workspaceId, index)
  return index
}

async function loadPhones(db: ImportDb, workspaceId: string, leads: MappedLead[], index: CompanyIndex) {
  const numbers = [...new Set(leads.flatMap((lead) => lead.points.map((point) => point.e164)))]
  for (const chunk of inChunks(numbers)) {
    const { data, error } = await db
      .from('contact_points')
      .select('company_id, e164')
      .eq('workspace_id', workspaceId)
      .in('e164', chunk)
    if (error) throw stepError(MODULE, 'read existing phone numbers', error)
    for (const row of data) index.byPhone.set(row.e164, row.company_id)
  }
}

async function loadNamesAndDomains(db: ImportDb, workspaceId: string, index: CompanyIndex) {
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from('companies')
      .select('id, name, city, website_url, website_invalid')
      .eq('workspace_id', workspaceId)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw stepError(MODULE, 'read existing companies', error)

    for (const row of data) {
      const domain = row.website_url ? matchableDomain(row.website_url, row.website_invalid) : null
      if (domain) addDomain(index, domain, row.id)
      addNameAndCity(index, row.name, row.city, row.id)
    }
    if (data.length < PAGE_SIZE) return
  }
}
