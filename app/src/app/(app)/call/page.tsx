/**
 * /call - placeholder until the calling cockpit is built (heading only).
 * Rendered inside the (app) shell.
 */
import type { Metadata } from 'next'
import { Surface } from '@/components/glass/Surface'

export const metadata: Metadata = { title: 'Call | ThrivvSkale CRM' }

export default function CallPage() {
  return (
    <Surface level="L2" className="p-6">
      <h1 className="text-2xl font-semibold">Call</h1>
    </Surface>
  )
}
