/**
 * Reads the lead list's URL query (?q=&vertical=&area=&priority=&status=&page=)
 * into safe values. Anything missing, repeated or invalid falls back to "not
 * set". Pure. Called by the /leads page; listLeads trusts the result.
 */
import type { Priority } from '@/lib/domain'

export interface LeadListParams {
  q: string
  vertical: string
  area: string
  priority: Priority | ''
  websiteStatus: string
  page: number
}

type RawParams = Record<string, string | string[] | undefined>

const MAX_TEXT = 100
const MAX_PAGE = 1000

export function parseListParams(raw: RawParams): LeadListParams {
  return {
    q: text(raw.q),
    vertical: text(raw.vertical),
    area: text(raw.area),
    priority: priority(raw.priority),
    websiteStatus: text(raw.status),
    page: page(raw.page),
  }
}

/** The first value when a parameter is repeated. */
function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

function text(value: string | string[] | undefined): string {
  return first(value).trim().slice(0, MAX_TEXT)
}

function priority(value: string | string[] | undefined): Priority | '' {
  const candidate = first(value)
  return candidate === 'A' || candidate === 'B' || candidate === 'C' ? candidate : ''
}

function page(value: string | string[] | undefined): number {
  const number = Number.parseInt(first(value), 10)
  if (!Number.isFinite(number) || number < 1) return 1
  return Math.min(number, MAX_PAGE)
}
