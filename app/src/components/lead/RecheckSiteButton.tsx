'use client'

/**
 * The "Re-check website" button in the lead header. Calls the recheckSite
 * server action, shows the new website status, and refreshes the page data.
 * Used by LeadHeader.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { recheckSite } from '@/app/actions/recheckSite'
import { BUTTON } from './styles'

export function RecheckSiteButton({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  function recheck() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await recheckSite(companyId)
        setMessage({ text: `Checked: ${result.websiteStatus}`, isError: false })
        router.refresh()
      } catch (error) {
        console.error('[RecheckSiteButton] recheckSite failed', error)
        setMessage({ text: 'The check could not run for this address.', isError: true })
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={BUTTON} disabled={pending} onClick={recheck}>
        {pending ? 'Checking...' : 'Re-check website'}
      </button>
      {message && <p role={message.isError ? 'alert' : 'status'} className="text-sm">{message.text}</p>}
    </div>
  )
}
