'use client'

/**
 * The "add a note" box on the Timeline tab. Sends the text to the addNote
 * server action (which validates it again) and refreshes the page data.
 * Used by LeadTabs.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { addNote } from '@/app/actions/addNote'
import { BUTTON, FIELD } from './styles'

export function NoteForm({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await addNote(companyId, body)
        if (!result.ok) {
          setError(result.message)
          return
        }
        setBody('')
        router.refresh()
      } catch (failure) {
        console.error('[NoteForm] addNote failed', failure)
        setError('The note could not be saved. Try again.')
      }
    })
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor="lead-note" className="text-sm font-medium">Add a note</label>
      <textarea
        id="lead-note"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className={FIELD}
      />
      <div>
        <button type="submit" className={BUTTON} disabled={pending || body.trim() === ''}>
          {pending ? 'Saving...' : 'Save note'}
        </button>
      </div>
      {error && <p role="alert" className="break-words text-sm">{error}</p>}
    </form>
  )
}
