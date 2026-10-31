/**
 * /today - placeholder until the Today screen is built (heading only).
 * The sign-in redirect lands here. Rendered inside the (app) shell.
 */
import type { Metadata } from 'next'
import { Surface } from '@/components/glass/Surface'

export const metadata: Metadata = { title: 'Today | ThrivvSkale CRM' }

export default function TodayPage() {
  return (
    <Surface level="L2" className="p-6">
      <h1 className="text-2xl font-semibold">Today</h1>
    </Surface>
  )
}
