'use client'

/**
 * Lists the outcomes the server refused for good: company, outcome and reason.
 * They no longer hold up the queue. Each stays until the user removes it, and the
 * confirm names the company and outcome. Nothing renders when none. Used by CallCockpit.
 */
import { Surface } from '@/components/glass/Surface'
import { BUTTON } from '@/components/lead/styles'
import { OUTCOME_LABELS } from '@/lib/call/outcomeLabels'
import type { DeadLetter } from '@/lib/offline/outbox'
import { removeQuestion } from '@/lib/offline/outboxStatus'

export interface RefusedOutcomesProps {
  letters: DeadLetter[]
  onRemove: (clientId: string) => void
}

export function RefusedOutcomes({ letters, onRemove }: RefusedOutcomesProps) {
  if (letters.length === 0) return null
  return (
    <Surface level="L2" role="alert" data-testid="refused-outcomes" className="flex flex-col gap-3 p-4">
      <h2 className="text-lg font-semibold">Outcomes the server refused</h2>
      <ul className="flex flex-col gap-3">
        {letters.map((letter) => (
          <li key={letter.clientId} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">
                {letter.companyName}: {OUTCOME_LABELS[letter.payload.outcome]}
              </p>
              <p className="break-words text-sm">{letter.reason}</p>
            </div>
            <button
              type="button"
              className={BUTTON}
              onClick={() => {
                if (window.confirm(removeQuestion(letter))) onRemove(letter.clientId)
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </Surface>
  )
}
