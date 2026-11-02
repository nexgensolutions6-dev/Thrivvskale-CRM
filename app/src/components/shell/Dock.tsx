'use client'
/**
 * The floating dock: main navigation on screens 768px wide and up (phones get
 * TabBar). Hidden with display:none below that width, so a screen reader never
 * meets two navigations at once. Mounted by the app layout.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Surface } from '@/components/glass/Surface'
import { NAV_ITEMS, isNavActive } from '@/lib/shell/nav-items'
import { NavIcon } from './NavIcon'

export function Dock() {
  const pathname = usePathname()
  return (
    <Surface level="L1" data-testid="dock" className="fixed bottom-4 left-1/2 z-30 hidden -translate-x-1/2 md:block">
      <nav aria-label="Main">
        <ul className="flex gap-1 p-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isNavActive(pathname, item.href) ? 'page' : undefined}
                className="flex w-20 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs transition-colors
                  hover:bg-black/5 aria-[current=page]:bg-black/10 aria-[current=page]:font-semibold
                  dark:hover:bg-white/10 dark:aria-[current=page]:bg-white/15
                  forced-colors:aria-[current=page]:underline"
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Surface>
  )
}
