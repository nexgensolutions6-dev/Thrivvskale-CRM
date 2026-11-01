'use client'

/**
 * One objection in the drawer: a button that selects it (attaches it to the
 * outcome) and, while selected, shows the response in the contact's mix. When
 * only the English answer exists it offers "Rewrite in your mix", which calls
 * the createAiDraft action and refreshes the page so the draft appears.
 * Used by ObjectionDrawer.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createAiDraft } from '@/app/actions/rewrite'
import { BUTTON, CHIP, MUTED } from '@/components/lead/styles'
import type { CallObjection } from '@/lib/call/callScreen'
import type { Mix } from '@/lib/domain'
import { pickObjectionResponse } from '@/lib/content/pickObjectionResponse'

const MODULE = 'ObjectionItem'
const REWRITE_FAILED = 'The rewrite could not be written. Try again in a moment.'

export interface ObjectionItemProps {
  objection: CallObjection
  mix: Mix
  selected: boolean
  onToggle: () => void
}

export function ObjectionItem({ objection, mix, selected, onToggle }: ObjectionItemProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const response = pickObjectionResponse(objection, mix)

  function rewrite() {
    if (objection.englishId === null) return
    const englishId = objection.englishId
    setError(null)
    startTransition(async () => {
      try {
        await createAiDraft(englishId, mix, 'latin', 'formal')
        router.refresh()
      } catch (failure) {
        console.error(`[${MODULE}] rewrite objection ${objection.id} in the contact's mix failed`, failure)
        setError(REWRITE_FAILED)
      }
    })
  }

  return (
    <li className="flex flex-col gap-2">
      <button type="button" className={`${BUTTON} justify-start text-left`} aria-pressed={selected} onClick={onToggle}>
        {objection.text}
      </button>
      {selected && (
        <div className="flex flex-col gap-2 pl-2">
          <p data-testid="objection-response" className="min-w-0 whitespace-pre-wrap break-words">{response.body}</p>
          {response.isDraft && <span className={`${CHIP} self-start`}>Draft rewrite, not approved yet</span>}
          {response.needsRewrite && (
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-sm ${MUTED}`}>Shown in English</span>
              <button type="button" className={BUTTON} disabled={pending} onClick={rewrite}>
                {pending ? 'Writing...' : 'Rewrite in your mix'}
              </button>
            </div>
          )}
          {error && <p role="alert" className="text-sm">{error}</p>}
        </div>
      )}
    </li>
  )
}
