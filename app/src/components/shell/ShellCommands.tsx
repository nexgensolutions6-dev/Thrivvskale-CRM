'use client'
/**
 * Renders nothing. Registers the palette's built-in commands (go to a main page,
 * open settings, add leads from a CSV) while the shell is on screen, and removes
 * them when it goes. Screens add their own with registerCommand. Mounted by the app layout.
 */
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { registerCommand, type Command } from '@/lib/shell/commands'
import { NAV_ITEMS } from '@/lib/shell/nav-items'

export function ShellCommands() {
  const router = useRouter()

  useEffect(() => {
    const go = (path: string) => () => router.push(path)
    const commands: Command[] = [
      ...NAV_ITEMS.map((item) => ({ id: `go-${item.icon}`, label: `Go to ${item.label}`, run: go(item.href) })),
      { id: 'open-settings', label: 'Open settings', run: go('/more/settings') },
      { id: 'import-leads', label: 'Add leads from CSV', run: go('/more/import') },
    ]
    const unregisterAll = commands.map(registerCommand)
    return () => unregisterAll.forEach((unregister) => unregister())
  }, [router])

  return null
}
