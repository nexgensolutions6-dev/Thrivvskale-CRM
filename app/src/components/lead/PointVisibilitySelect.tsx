'use client'

/**
 * One phone number's "who can see this" choice in the PrivacyMenu. Only
 * "everyone in the workspace" is offered until RLS enforces owner_only. Calls
 * the setPointVisibility server action, which validates the value again, and
 * refreshes the page data.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { setPointVisibility } from '@/app/actions/privacy'
import type { LeadPoint } from '@/lib/leads/leadView'
import { FIELD } from './styles'

export function PointVisibilitySelect({ point }: { point: LeadPoint }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const selectId = `visibility-${point.id}`

  function change(value: string) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await setPointVisibility(point.id, value)
        if (!result.ok) setError(result.message)
        else router.refresh()
      } catch (failure) {
        console.error(`[PointVisibilitySelect] setPointVisibility failed for number ${point.id}`, failure)
        setError('The change could not be saved. Try again.')
      }
    })
  }

  return (
    <div className="grid gap-1 sm:grid-cols-[1fr_14rem] sm:items-center">
      <label htmlFor={selectId} className="text-sm">{`Who can see ${point.e164}`}</label>
      <select
        id={selectId}
        className={FIELD}
        value={point.visibility}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
      >
        <option value="workspace">Everyone in the workspace</option>
        {/* "Only the owner" returns once RLS enforces owner_only; until then it is
            shown only for a number already set to it. */}
        {point.visibility === 'owner_only' && <option value="owner_only">Only the owner (not enforced yet)</option>}
      </select>
      {error && <p role="alert" className="break-words text-sm sm:col-span-2">{error}</p>}
    </div>
  )
}
