/**
 * /leads - the lead list: search, filters (vertical, area, priority, website
 * status) and 50 leads per page, each linking to its workspace. Reads the
 * signed-in user's own workspace with their own client (the layout's sign-in
 * check does not re-run on soft navigation). The (app) layout supplies <main>.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { Surface } from '@/components/glass/Surface'
import { LeadFilters } from '@/components/lead/LeadFilters'
import { LeadRow } from '@/components/lead/LeadRow'
import { BUTTON, MUTED } from '@/components/lead/styles'
import { listHref } from '@/lib/leads/listHref'
import { listLeads } from '@/lib/leads/listLeads'
import { parseListParams } from '@/lib/leads/listParams'
import { loadFilterOptions } from '@/lib/leads/loadFilterOptions'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export const metadata: Metadata = { title: 'Leads | ThrivvSkale CRM' }

type SearchParams = Record<string, string | string[] | undefined>

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { workspaceId } = await getSessionWorkspace()
  const params = parseListParams(await searchParams)
  const db = await createSupabaseServerClient()
  const [page, options] = await Promise.all([
    listLeads(db, workspaceId, params),
    loadFilterOptions(db, workspaceId),
  ])

  return (
    <div className="flex flex-col gap-4">
      <Surface level="L3" className="flex flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <LeadFilters params={params} options={options} />
      </Surface>

      <Surface level="L2" className="flex flex-col gap-3 p-4 sm:p-6">
        {page.rows.length === 0 ? (
          <p role="status">No leads match. Clear the filters, or import a CSV from More.</p>
        ) : (
          <ul className="glass-list flex flex-col gap-2" aria-label="Leads">
            {page.rows.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </ul>
        )}
        <div role="group" aria-label="Lead pages" className="flex flex-wrap items-center gap-3">
          {params.page > 1 && (
            <Link href={listHref(params, params.page - 1)} className={BUTTON}>Previous</Link>
          )}
          <span className={`text-sm ${MUTED}`}>Page {params.page}</span>
          {page.hasNext && <Link href={listHref(params, params.page + 1)} className={BUTTON}>Next</Link>}
        </div>
      </Surface>
    </div>
  )
}
