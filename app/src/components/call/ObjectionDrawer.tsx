'use client'

/**
 * The call card's Objections drawer: a toggle that opens the list of known
 * objections. Selecting one shows its answer and marks it to be logged with the
 * outcome (the selection lives in LeadCallFlow). Used by CallCard.
 */
import { useState } from 'react'
import { BUTTON, MUTED } from '@/components/lead/styles'
import type { CallObjection } from '@/lib/call/callScreen'
import type { Mix } from '@/lib/domain'
import { ObjectionItem } from './ObjectionItem'

export interface ObjectionDrawerProps {
  objections: CallObjection[]
  /** The mix of the number being called. */
  mix: Mix
  selectedIds: string[]
  onToggle: (objectionId: string) => void
}

export function ObjectionDrawer({ objections, mix, selectedIds, onToggle }: ObjectionDrawerProps) {
  const [open, setOpen] = useState(false)
  if (objections.length === 0) return null

  return (
    <section aria-labelledby="objections-toggle" className="flex flex-col gap-3">
      <button
        id="objections-toggle"
        type="button"
        className={`${BUTTON} self-start`}
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {selectedIds.length > 0 ? `Objections (${selectedIds.length} selected)` : 'Objections'}
      </button>
      {open && (
        <>
          <p className={`text-sm ${MUTED}`}>Select what you heard: it is saved with the outcome.</p>
          <ul aria-label="Objections" className="flex flex-col gap-3">
            {objections.map((objection) => (
              <ObjectionItem
                key={objection.id}
                objection={objection}
                mix={mix}
                selected={selectedIds.includes(objection.id)}
                onToggle={() => onToggle(objection.id)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
