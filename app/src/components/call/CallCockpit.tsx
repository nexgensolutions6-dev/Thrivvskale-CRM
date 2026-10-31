'use client'

/**
 * The calling cockpit: shows the first lead not yet logged, queues each outcome
 * in the outbox and moves straight on, online or offline. When the batch runs
 * out it offers the next one, or says all caught up. Used by the /call page.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Surface } from '@/components/glass/Surface'
import { BUTTON } from '@/components/lead/styles'
import type { CallScreen } from '@/lib/call/callScreen'
import type { OutboxOp } from '@/lib/offline/outbox'
import { useOutbox } from '@/lib/offline/useOutbox'
import { LeadCallFlow } from './LeadCallFlow'
import { OutboxStatus } from './OutboxStatus'

export interface CallCockpitProps {
  workspaceId: string
  screen: CallScreen
}

export function CallCockpit({ workspaceId, screen }: CallCockpitProps) {
  const router = useRouter()
  const outbox = useOutbox(workspaceId)
  const [loggedIds, setLoggedIds] = useState<ReadonlySet<string>>(new Set())

  const isDone = (companyId: string) =>
    loggedIds.has(companyId) || outbox.waiting.some((op) => op.payload.companyId === companyId)
  const lead = screen.leads.find((candidate) => !isDone(candidate.companyId))

  async function submit(op: OutboxOp) {
    await outbox.submit(op)
    setLoggedIds((ids) => new Set(ids).add(op.payload.companyId))
  }

  function loadNextBatch() {
    setLoggedIds(new Set())
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <OutboxStatus
        count={outbox.waiting.length}
        stuck={outbox.stuck}
        onDiscard={() => void outbox.discardOldest()}
      />
      {lead ? (
        <LeadCallFlow key={lead.companyId} lead={lead} objections={screen.objections} onSubmit={submit} />
      ) : screen.moreWaiting ? (
        <Surface level="L2" className="flex flex-col items-start gap-3 p-6">
          <h2 className="text-2xl font-semibold">Batch done</h2>
          {outbox.waiting.length > 0 ? (
            <p>Reconnect to send your outcomes and load more leads.</p>
          ) : (
            <button type="button" className={BUTTON} onClick={loadNextBatch}>Load next leads</button>
          )}
        </Surface>
      ) : (
        <Surface level="L2" className="flex flex-col gap-2 p-6">
          <h2 className="text-2xl font-semibold">All caught up</h2>
          <p>
            {screen.scheduledLater > 0
              ? `Nothing to call right now. ${screen.scheduledLater} scheduled for later.`
              : 'Nothing to call right now.'}
          </p>
        </Surface>
      )}
    </div>
  )
}
