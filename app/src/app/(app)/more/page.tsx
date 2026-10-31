/**
 * /more - the list of less-used screens: Settings and Import. Rendered inside
 * the (app) shell; the dock and tab bar keep "More" lit on these pages too.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { Surface } from '@/components/glass/Surface'

export const metadata: Metadata = { title: 'More | ThrivvSkale CRM' }

const LINKS = [
  { href: '/more/settings', label: 'Settings', hint: 'Glass effects and other preferences' },
  { href: '/more/import', label: 'Import leads', hint: 'Add leads from a CSV file' },
]

export default function MorePage() {
  return (
    <Surface level="L2" className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">More</h1>
      <ul className="flex flex-col gap-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="block rounded-xl px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10">
              <span className="font-medium">{link.label}</span>
              <span className="block text-sm text-(--glass-text-secondary)">{link.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  )
}
