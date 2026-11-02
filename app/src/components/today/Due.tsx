/**
 * "Due now": callbacks first, then tasks, whose time has come. A badge marks
 * each item (Overdue or Due now) and the heading shows a count, both only when
 * something is due. Used by the Today page.
 */
import Link from 'next/link'
import { Surface } from '@/components/glass/Surface'
import type { DueItem } from '@/lib/today/types'

const BADGE_CLASS = 'rounded-full border border-current px-2 py-0.5 text-xs font-semibold whitespace-nowrap'

function DueRow({ item }: { item: DueItem }) {
  const kind = item.type === 'callback' ? 'callback' : 'task'
  return (
    <li data-kind={kind} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span data-testid="due-badge" className={BADGE_CLASS}>
        {item.badge === 'overdue' ? 'Overdue' : 'Due now'}
      </span>
      <span className="min-w-0 break-words font-medium">{item.title}</span>
      {item.companyId && item.companyName && (
        <Link href={`/leads/${item.companyId}`} className="min-w-0 break-words underline">
          {item.companyName}
        </Link>
      )}
    </li>
  )
}

export function Due({ items }: { items: DueItem[] }) {
  return (
    <Surface level="L2" className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        Due now
        {items.length > 0 && (
          <span data-testid="due-count" className={BADGE_CLASS}>{items.length}</span>
        )}
      </h2>
      {items.length === 0 ? (
        <p data-testid="due-list">Nothing is due right now.</p>
      ) : (
        <ul data-testid="due-list" className="flex flex-col gap-3">
          {items.map((item) => <DueRow key={item.id} item={item} />)}
        </ul>
      )}
    </Surface>
  )
}
