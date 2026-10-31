/**
 * Builds the /leads address for a set of list params and a page number,
 * leaving out anything not set. The inverse of parseListParams. Pure. Called
 * by the /leads page for the Previous / Next links.
 */
import type { LeadListParams } from './listParams'

export function listHref(params: LeadListParams, page: number): string {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.vertical) query.set('vertical', params.vertical)
  if (params.area) query.set('area', params.area)
  if (params.priority) query.set('priority', params.priority)
  if (params.websiteStatus) query.set('status', params.websiteStatus)
  if (page > 1) query.set('page', String(page))
  const text = query.toString()
  return text ? `/leads?${text}` : '/leads'
}
