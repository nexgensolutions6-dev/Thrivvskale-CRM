'use client'

/**
 * "Export data" and "Erase" for one person in the PrivacyMenu. Export saves
 * the exportContact JSON as a file; Erase asks once more, then calls
 * eraseContact (numbers, name and notes go; the company stays) and refreshes.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { eraseContact, exportContact } from '@/app/actions/privacy'
import { BUTTON } from './styles'

type Message = { text: string; isError: boolean }

function saveJsonFile(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function ContactPrivacyActions({ contactId, label }: { contactId: string; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  /** Runs one action; it returns the message to show (or null), a throw becomes a generic error. */
  function run(step: 'Export' | 'Erase', action: () => Promise<Message | null>) {
    setMessage(null)
    startTransition(async () => {
      try {
        setMessage(await action())
      } catch (failure) {
        console.error(`[ContactPrivacyActions] ${step} failed for contact ${contactId}`, failure)
        setMessage({ text: `${step} did not finish. Try again.`, isError: true })
      }
    })
  }

  const doExport = () =>
    run('Export', async () => {
      const result = await exportContact(contactId)
      if (!result.ok) return { text: result.message, isError: true }
      saveJsonFile(`contact-${contactId}.json`, result.data)
      return { text: 'Export saved.', isError: false }
    })

  const doErase = () =>
    run('Erase', async () => {
      const result = await eraseContact(contactId)
      if (!result.ok) return { text: result.message, isError: true }
      setConfirming(false)
      router.refresh()
      return null
    })

  return (
    <li className="glass-row flex flex-col gap-2 px-4 py-3">
      <span className="min-w-0 break-words font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON} disabled={pending} onClick={doExport}>
          {`Export ${label}'s data`}
        </button>
        {!confirming && (
          <button type="button" className={BUTTON} disabled={pending} onClick={() => setConfirming(true)}>
            {`Erase ${label}`}
          </button>
        )}
      </div>
      {confirming && (
        <div role="group" aria-label={`Confirm erasing ${label}`} className="flex flex-col gap-2">
          <p className="text-sm">
            Their numbers, name and notes are deleted for good. The company and an emptied call history stay.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON} disabled={pending} onClick={doErase}>
              {pending ? 'Erasing...' : 'Yes, erase for good'}
            </button>
            <button type="button" className={BUTTON} disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role={message.isError ? 'alert' : 'status'} className="break-words text-sm">{message.text}</p>
      )}
    </li>
  )
}
