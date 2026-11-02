'use client'

/**
 * Shows how many outcomes are waiting to reach the server, and says so when the
 * oldest could not be delivered. It offers no discard: these will be retried and
 * nothing is lost. Nothing renders when the outbox is empty. Used by CallCockpit.
 */
import { Surface } from '@/components/glass/Surface'
import { waitingLabel } from '@/lib/offline/outboxStatus'

export function OutboxStatus({ count, stuck }: { count: number; stuck: boolean }) {
  if (count === 0) return null
  return (
    <Surface level="L2" role="status" data-testid="outbox-status" className="flex flex-wrap items-center gap-3 p-4">
      <p>{waitingLabel(count)}</p>
      {stuck && <p className="text-sm">Could not reach the server. It will be tried again, nothing is lost.</p>}
    </Surface>
  )
}
