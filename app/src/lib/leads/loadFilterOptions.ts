/**
 * `loadFilterOptions`: the verticals and website statuses that exist in a
 * workspace, sorted, for the lead list's filter drop-downs. Reads the column
 * in pages of 1000 (the API's row cap) and de-duplicates here. Uses the
 * signed-in user's client. Called by the /leads page.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'

const MODULE = 'loadFilterOptions'
const PAGE = 1000
const MAX_PAGES = 20

export interface FilterOptions {
  verticals: string[]
  websiteStatuses: string[]
}

export async function loadFilterOptions(db: SupabaseClient<Database>, workspaceId: string): Promise<FilterOptions> {
  const verticals = new Set<string>()
  const statuses = new Set<string>()

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await db
      .from('companies')
      .select('id, vertical, website_status')
      .eq('workspace_id', workspaceId)
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (result.error) throw stepError(MODULE, `read filter values (page ${page + 1})`, result.error)

    for (const row of result.data) {
      if (row.vertical) verticals.add(row.vertical)
      if (row.website_status) statuses.add(row.website_status)
    }
    if (result.data.length < PAGE) break
  }
  return { verticals: [...verticals].sort(), websiteStatuses: [...statuses].sort() }
}
