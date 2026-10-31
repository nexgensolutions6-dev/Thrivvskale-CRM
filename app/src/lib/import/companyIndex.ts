/**
 * Finds the company a lead already belongs to. Called by importPlan.
 * A lead matches on ANY of its phone numbers; failing that, on its website
 * domain, but only a business's own domain (never a platform page such as
 * justdial.com or a bare netlify.app, which many unrelated leads share).
 * A lead with neither a phone nor such a domain has nothing else to go on, so
 * it matches on company name + city; without that, re-importing a file would
 * add those leads again every time.
 */
import { hostOfUrl } from '@/lib/import/websiteHost'
import type { MappedLead } from '@/lib/import/mapLeadRow'

/** Which company id owns each phone number and each own-website domain. */
export interface CompanyIndex {
  byPhone: Map<string, string>
  byDomain: Map<string, string>
  byNameAndCity: Map<string, string>
}

export function emptyIndex(): CompanyIndex {
  return { byPhone: new Map(), byDomain: new Map(), byNameAndCity: new Map() }
}

/** The domain to match on, or null for no website, junk, or a platform address. */
export function matchableDomain(websiteUrl: string | null, websiteInvalid: boolean): string | null {
  if (websiteUrl === null || websiteInvalid) return null
  return hostOfUrl(websiteUrl)
}

export function findCompanyId(index: CompanyIndex, lead: MappedLead): string | null {
  for (const point of lead.points) {
    const byPhone = index.byPhone.get(point.e164)
    if (byPhone) return byPhone
  }
  const domain = matchableDomain(lead.company.websiteUrl, lead.company.websiteInvalid)
  if (domain) return index.byDomain.get(domain) ?? null
  if (lead.points.length > 0) return null
  return index.byNameAndCity.get(nameAndCityKey(lead.company.name, lead.company.city)) ?? null
}

/** Records a lead's phones and domain as belonging to a company, so later leads match it. */
export function addToIndex(index: CompanyIndex, lead: MappedLead, companyId: string): void {
  for (const point of lead.points) {
    if (!index.byPhone.has(point.e164)) index.byPhone.set(point.e164, companyId)
  }
  const domain = matchableDomain(lead.company.websiteUrl, lead.company.websiteInvalid)
  if (domain) addDomain(index, domain, companyId)
  addNameAndCity(index, lead.company.name, lead.company.city, companyId)
}

/** The first company seen on a domain keeps it. */
export function addDomain(index: CompanyIndex, domain: string, companyId: string): void {
  if (!index.byDomain.has(domain)) index.byDomain.set(domain, companyId)
}

export function addNameAndCity(index: CompanyIndex, name: string, city: string | null, companyId: string): void {
  const key = nameAndCityKey(name, city ?? '')
  if (!index.byNameAndCity.has(key)) index.byNameAndCity.set(key, companyId)
}

function nameAndCityKey(name: string, city: string): string {
  return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}`
}
