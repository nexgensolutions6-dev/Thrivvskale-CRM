/**
 * The lead list's search box and filters (vertical, area, priority, website
 * status) as a plain GET form: submitting it reloads /leads with the values in
 * the address, which the page reads with parseListParams. No client code.
 * Used by the /leads page.
 */
import Link from 'next/link'
import type { FilterOptions } from '@/lib/leads/loadFilterOptions'
import type { LeadListParams } from '@/lib/leads/listParams'
import { BUTTON, FIELD } from './styles'

export function LeadFilters({ params, options }: { params: LeadListParams; options: FilterOptions }) {
  return (
    <form method="get" action="/leads" role="search" aria-label="Lead filters" className="grid gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="lead-q" className="text-sm font-medium">Search</label>
        <input
          id="lead-q"
          name="q"
          type="search"
          defaultValue={params.q}
          placeholder="Name, area, tag or contact"
          className={FIELD}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          id="lead-vertical"
          name="vertical"
          label="Vertical"
          value={params.vertical}
          options={options.verticals}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="lead-area" className="text-sm font-medium">Area</label>
          <input id="lead-area" name="area" defaultValue={params.area} className={FIELD} />
        </div>
        <Select id="lead-priority" name="priority" label="Priority" value={params.priority} options={['A', 'B', 'C']} />
        <Select
          id="lead-status"
          name="status"
          label="Website status"
          value={params.websiteStatus}
          options={options.websiteStatuses}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={BUTTON}>Apply</button>
        <Link href="/leads" className={BUTTON}>Clear</Link>
      </div>
    </form>
  )
}

function Select(props: { id: string; name: string; label: string; value: string; options: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.id} className="text-sm font-medium">{props.label}</label>
      <select id={props.id} name={props.name} defaultValue={props.value} className={FIELD}>
        <option value="">Any</option>
        {props.options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}
