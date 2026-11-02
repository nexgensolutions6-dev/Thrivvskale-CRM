'use client'

/**
 * The lead page's "Privacy" section: do-not-disturb for the company (with an
 * optional reason; a DND lead leaves the calling queue), export or erase each
 * person, and who can see each number. Rendered by /leads/[id]; every change
 * goes through the server actions in src/app/actions/privacy.ts. It also holds
 * the erase audio warning, which must outlive the erased person's row.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { setDnd } from '@/app/actions/privacy'
import type { LeadContact, LeadPoint } from '@/lib/leads/leadView'
import { ContactPrivacyActions } from './ContactPrivacyActions'
import { PointVisibilitySelect } from './PointVisibilitySelect'
import { BUTTON, FIELD, MUTED } from './styles'

export interface PrivacyMenuProps {
  companyId: string
  dnd: boolean
  contacts: LeadContact[]
  points: LeadPoint[]
}

function audioWarning(count: number): string {
  return `Erased, but ${count} voice note file(s) could not be deleted. Tell an admin.`
}

export function PrivacyMenu({ companyId, dnd, contacts, points }: PrivacyMenuProps) {
  const [eraseWarning, setEraseWarning] = useState<string | null>(null)
  const onErased = (audioNotRemoved: number) => {
    setEraseWarning(audioNotRemoved > 0 ? audioWarning(audioNotRemoved) : null)
  }

  return (
    <section aria-label="Privacy">
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold">Privacy</summary>
        <div className="flex flex-col gap-4 pt-2">
          <DndControl companyId={companyId} dnd={dnd} />
          {eraseWarning && <p role="alert" className="break-words text-sm">{eraseWarning}</p>}
          {contacts.length > 0 && (
            <ul aria-label="People" className="flex flex-col gap-2">
              {contacts.map((contact) => (
                <ContactPrivacyActions
                  key={contact.id}
                  contactId={contact.id}
                  label={contact.name ?? contact.nameLatin ?? 'Unnamed'}
                  onErased={onErased}
                />
              ))}
            </ul>
          )}
          {points.length > 0 && (
            <div className="flex flex-col gap-2">
              {points.map((point) => (
                <PointVisibilitySelect key={point.id} point={point} />
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  )
}

function DndControl({ companyId, dnd }: { companyId: string; dnd: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await setDnd(companyId, !dnd, dnd ? undefined : note)
        if (!result.ok) {
          setError(result.message)
          return
        }
        setNote('')
        router.refresh()
      } catch (failure) {
        console.error(`[PrivacyMenu] setDnd failed for company ${companyId}`, failure)
        setError('The change could not be saved. Try again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className={`text-sm ${MUTED}`}>
        {dnd ? 'Do not disturb is on: this lead is out of the calling queue.' : 'Calls allowed.'}
      </p>
      {!dnd && (
        <>
          <label htmlFor="dnd-note" className="text-sm font-medium">Reason for do not disturb (optional)</label>
          <input
            id="dnd-note"
            className={FIELD}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </>
      )}
      <div>
        <button type="button" className={BUTTON} disabled={pending} onClick={toggle}>
          {pending ? 'Saving...' : dnd ? 'Allow calls again' : 'Mark do not disturb'}
        </button>
      </div>
      {error && <p role="alert" className="break-words text-sm">{error}</p>}
    </div>
  )
}
