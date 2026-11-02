/**
 * /more/settings - preferences. For now one: the "Lite glass" switch
 * (components/shell/LiteGlassToggle.tsx). Rendered inside the (app) shell.
 */
import type { Metadata } from 'next'
import { Surface } from '@/components/glass/Surface'
import { LiteGlassToggle } from '@/components/shell/LiteGlassToggle'

export const metadata: Metadata = { title: 'Settings | ThrivvSkale CRM' }

export default function SettingsPage() {
  return (
    <Surface level="L3" className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <LiteGlassToggle />
    </Surface>
  )
}
