/**
 * One row of the lead list: name, vertical and area, priority, website status
 * and score, linking to the lead workspace. Used by the /leads page.
 */
import Link from 'next/link'
import type { LeadListRow } from '@/lib/leads/listLeads'
import { CHIP, MUTED } from './styles'

export function LeadRow({ lead }: { lead: LeadListRow }) {
  const place = [lead.vertical, lead.area].filter(Boolean).join(' · ')
  return (
    <li>
      <Link href={`/leads/${lead.id}`} className="glass-row flex min-h-14 flex-col gap-1 px-4 py-3">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 break-words font-medium">{lead.name}</span>
          <span className="shrink-0 text-sm">Score {Math.round(lead.base_score)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {lead.priority && <span className={CHIP}>Priority {lead.priority}</span>}
          {place && <span className={`min-w-0 break-words ${MUTED}`}>{place}</span>}
          {lead.website_status && <span className={`min-w-0 break-words ${MUTED}`}>{lead.website_status}</span>}
        </span>
      </Link>
    </li>
  )
}
