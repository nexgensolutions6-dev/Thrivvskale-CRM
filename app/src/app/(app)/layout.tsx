/**
 * The signed-in shell around every screen in the (app) group: wallpaper, menu bar,
 * dock (wide screens) or tab bar (phones), and the command palette. Pages put their
 * content in glass panels (L2 or L3) inside <main>; body text never sits on the
 * menu bar or dock. Rendered by Next for /today, /call, /leads and /more/*.
 */
import type { ReactNode } from 'react'
import { CommandPalette } from '@/components/shell/CommandPalette'
import { Dock } from '@/components/shell/Dock'
import { GlassModeController } from '@/components/shell/GlassModeController'
import { MenuBar } from '@/components/shell/MenuBar'
import { ShellCommands } from '@/components/shell/ShellCommands'
import { TabBar } from '@/components/shell/TabBar'
import { wallpaperStyle } from '@/lib/glass/wallpaper-style'
import { loadMenuTargets } from '@/lib/shell/loadMenuTargets'
import { getSessionWorkspace } from '@/lib/workspace'

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Sends visitors without a session to /login (and creates a missing workspace).
  // Pages that read data call this again; it is cached, so the second call is free.
  const { workspaceId } = await getSessionWorkspace()
  const targets = await loadMenuTargets(workspaceId)

  return (
    <div className="relative isolate min-h-dvh">
      <div aria-hidden="true" className="glass-wallpaper fixed inset-0 -z-10" style={wallpaperStyle('aurora')} />
      <GlassModeController />
      <ShellCommands />
      <MenuBar targets={targets} />
      <main className="mx-auto w-full max-w-5xl px-4 pt-24 pb-28 md:pb-32">{children}</main>
      <Dock />
      <TabBar />
      <CommandPalette />
    </div>
  )
}
