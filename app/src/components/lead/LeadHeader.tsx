/**
 * The top of the lead workspace: name, place, priority, a Google Maps button
 * and a website chip (status, link and Re-check). Server component; used by
 * the /leads/[id] page. The page's Surface wraps it.
 */
import Link from 'next/link'
import type { CompanyRow } from '@/lib/leads/leadView'
import { mapsUrl } from '@/lib/leads/mapsUrl'
import { siteHref } from '@/lib/leads/siteHref'
import { RecheckSiteButton } from './RecheckSiteButton'
import { BUTTON, CHIP, MUTED } from './styles'

export function LeadHeader({ company }: { company: CompanyRow }) {
  const place = [company.vertical, company.area, company.city].filter(Boolean).join(' · ')
  const link = siteHref(company.website_url)
  const canRecheck = Boolean(link) && !company.website_invalid

  return (
    <header className="flex flex-col gap-3">
      <Link href="/leads" className={`text-sm underline ${MUTED}`}>Back to leads</Link>
      <h1 className="min-w-0 break-words text-2xl font-semibold">{company.name}</h1>
      <p className={`min-w-0 break-words ${MUTED}`}>{place || 'No place on file'}</p>
      <div className="flex flex-wrap items-center gap-2">
        {company.priority && <span className={CHIP}>Priority {company.priority}</span>}
        <span className={CHIP}>Score {Math.round(company.base_score)}</span>
        {company.google_rating !== null && (
          <span className={CHIP}>{company.google_rating} stars ({company.google_reviews ?? 0})</span>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <a
          href={mapsUrl(company)}
          target="_blank"
          rel="noopener noreferrer"
          className={BUTTON}
          aria-label={`Open ${company.name} in Google Maps`}
        >
          Maps
        </a>
        <WebsiteChip company={company} link={link} />
        {canRecheck && <RecheckSiteButton companyId={company.id} />}
      </div>
    </header>
  )
}

function WebsiteChip({ company, link }: { company: CompanyRow; link: string | null }) {
  const status = company.website_status ?? 'Website not checked'
  if (!link) return <span className={CHIP}>{status}</span>
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={`${CHIP} min-h-11 break-all underline`}>
      Website: {status}
    </a>
  )
}
