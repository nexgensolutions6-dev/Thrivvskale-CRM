'use client'

/**
 * Shows how many outcomes are waiting to reach the server. When the oldest keeps
 * failing while online it can be discarded, so one refused outcome cannot hold
 * back the rest. Nothing renders when the outbox is empty. Used by CallCockpit.
 */
import { Surface } from '@/components/glass/Surface'
import { BUTTON } from '@/components/lead/styles'

const DISCARD_QUESTION = 'Discard the oldest waiting outcome? It will not be logged.'

export function OutboxStatus({ count, stuck, onDiscard }: { count: number; stuck: boolean; onDiscard: () => void }) {
  if (count === 0) return null
  return (
    <Surface level="L2" role="status" data-testid="outbox-status" className="flex flex-wrap items-center gap-3 p-4">
      <p>{count === 1 ? '1 outcome waiting to send' : `${count} outcomes waiting to send`}</p>
      {stuck && (
        <>
          <p className="text-sm">The oldest one could not be sent. It will be tried again.</p>
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              if (window.confirm(DISCARD_QUESTION)) onDiscard()
            }}
          >
            Discard it
          </button>
        </>
      )}
    </Surface>
  )
}
