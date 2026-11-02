'use client'
/**
 * The bottom tab bar: main navigation on phones, below 768px (wider screens get
 * Dock). Hidden with display:none from 768px up, so a screen reader never meets
 * two navigations at once. Mounted by the app layout.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Surface } from '@/components/glass/Surface'
import { NAV_ITEMS, isNavActive } from '@/lib/shell/nav-items'
import { NavIcon } from './NavIcon'

export function TabBar() {
  const pathname = usePathname()
  return (
    <Surface
      level="L1"
      data-testid="tab-bar"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 md:hidden"
    >
      <nav aria-label="Main">
        <ul className="grid grid-cols-4 gap-1 p-1.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isNavActive(pathname, item.href) ? 'page' : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs
                  transition-colors aria-[current=page]:bg-black/10 aria-[current=page]:font-semibold
                  dark:aria-[current=page]:bg-white/15 forced-colors:aria-[current=page]:underline"
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
