/**
 * /leads - placeholder until the lead list is built (heading only).
 * Rendered inside the (app) shell.
 */
import type { Metadata } from 'next'
import { Surface } from '@/components/glass/Surface'

export const metadata: Metadata = { title: 'Leads | ThrivvSkale CRM' }

export default function LeadsPage() {
  return (
    <Surface level="L2" className="p-6">
      <h1 className="text-2xl font-semibold">Leads</h1>
    </Surface>
  )
}
