/**
 * The four places in the app's main navigation. One list, so the dock (wide
 * screens) and the tab bar (phones) can never disagree. Used by Dock, TabBar
 * and the palette's "Go to ..." commands.
 */

export type NavIconName = 'today' | 'call' | 'leads' | 'more'

export interface NavItem {
  href: string
  label: string
  icon: NavIconName
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/today', label: 'Today', icon: 'today' },
  { href: '/call', label: 'Call', icon: 'call' },
  { href: '/leads', label: 'Leads', icon: 'leads' },
  { href: '/more', label: 'More', icon: 'more' },
]

/** True on the item's own page and on any page below it (/more/settings keeps "More" lit). */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
