/**
 * `listLeads`: one page (50) of the lead list for a workspace, ordered by
 * priority (A first) then score, with optional search text and filters
 * (vertical, area, priority, website status). Search runs the search_leads
 * SQL function (up to 100 matches), then the filters and paging apply to
 * those. Uses the signed-in user's client. Called by the /leads page.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import type { Priority } from '@/lib/domain'
import { stepError } from '@/lib/step-error'
import type { LeadListParams } from './listParams'

const MODULE = 'listLeads'
export const PAGE_SIZE = 50
const SEARCH_LIMIT = 100
const COLUMNS = 'id, name, vertical, area, priority, website_status, base_score, score, stage'

export interface LeadListRow {
  id: string
  name: string
  vertical: string | null
  area: string | null
  priority: Priority | null
  website_status: string | null
  base_score: number
  score: number
  stage: string
}

export interface LeadListPage {
  rows: LeadListRow[]
  hasNext: boolean
}

export async function listLeads(
  db: SupabaseClient<Database>,
  workspaceId: string,
  params: LeadListParams,
): Promise<LeadListPage> {
  let query = db.from('companies').select(COLUMNS).eq('workspace_id', workspaceId)

  if (params.q) {
    const ids = await searchIds(db, workspaceId, params.q)
    if (ids.length === 0) return { rows: [], hasNext: false }
    query = query.in('id', ids)
  }
  if (params.vertical) query = query.eq('vertical', params.vertical)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.websiteStatus) query = query.eq('website_status', params.websiteStatus)
  if (params.area) query = query.ilike('area', `%${escapeLike(params.area)}%`)

  const from = (params.page - 1) * PAGE_SIZE
  const result = await query
    .order('priority', { ascending: true, nullsFirst: false })
    .order('base_score', { ascending: false })
    .order('name', { ascending: true })
    .range(from, from + PAGE_SIZE) // one extra row tells us whether a next page exists
  if (result.error) {
    throw stepError(MODULE, `list leads of workspace ${workspaceId} (page ${params.page})`, result.error)
  }

  const rows: LeadListRow[] = result.data
  return { rows: rows.slice(0, PAGE_SIZE), hasNext: rows.length > PAGE_SIZE }
}

async function searchIds(db: SupabaseClient<Database>, workspaceId: string, text: string): Promise<string[]> {
  const result = await db.rpc('search_leads', { ws: workspaceId, q: text, lim: SEARCH_LIMIT })
  if (result.error) throw stepError(MODULE, `search leads for ${JSON.stringify(text)}`, result.error)
  return result.data.map((row) => row.id)
}

/** In a LIKE pattern, % and _ are wildcards and \ escapes; the user typed plain text. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`)
}
