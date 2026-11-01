/**
 * "Next up": the lead the call queue would offer next, with a link into the
 * calling cockpit. Says so when the queue is empty. Used by the Today page.
 */
import Link from 'next/link'
import { Surface } from '@/components/glass/Surface'
import type { NextUp as NextUpLead } from '@/lib/today/types'

export function NextUp({ lead }: { lead: NextUpLead }) {
  return (
    <Surface level="L2" data-testid="next-up" className="flex flex-col gap-3 p-5">
      <h2 className="text-lg font-semibold">Next up</h2>
      {lead ? (
        <>
          <p className="break-words text-xl font-medium">{lead.name}</p>
          <Link href="/call" className="font-semibold underline">Start calling</Link>
        </>
      ) : (
        <p>No leads are waiting to be called. Import some on the More page.</p>
      )}
    </Surface>
  )
}
