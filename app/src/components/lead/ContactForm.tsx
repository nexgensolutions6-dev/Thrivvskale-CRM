'use client'

/**
 * The form to add a person to a lead, or edit one: name, name in English
 * letters (name_latin, which search uses to find Telugu and Hindi names), role,
 * languages (like "te+en"), a phone number and notes. Sends the values to the
 * saveContactAction server action, which validates them again on the server.
 * Used by PeoplePanel.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { saveContactAction } from '@/app/actions/saveContact'
import { CONTACT_ROLES } from '@/lib/domain'
import { ROLE_LABELS } from '@/lib/leads/labels'
import type { LeadContact } from '@/lib/leads/leadView'
import { BUTTON, FIELD } from './styles'

export function ContactForm({ companyId, contact }: { companyId: string; contact?: LeadContact }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const idPrefix = `contact-${contact?.id ?? 'new'}`

  function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const text = (key: string) => String(data.get(key) ?? '')
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const result = await saveContactAction({
          companyId,
          contactId: contact?.id ?? null,
          name: text('name'),
          nameLatin: text('nameLatin'),
          role: text('role'),
          languages: text('languages'),
          phone: text('phone'),
          notes: text('notes'),
        })
        if (!result.ok) {
          setError(result.message)
          return
        }
        setSaved(true)
        if (!contact) form.reset()
        router.refresh()
      } catch (failure) {
        console.error('[ContactForm] saveContactAction failed', failure)
        setError('The contact could not be saved. Try again.')
      }
    })
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit(event.currentTarget)
      }}
    >
      <Field id={`${idPrefix}-name`} name="name" label="Name" defaultValue={contact?.name} />
      <Field
        id={`${idPrefix}-latin`}
        name="nameLatin"
        label="Name in English letters"
        defaultValue={contact?.nameLatin}
        hint="Search uses this to find names written in Telugu or Hindi."
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-role`} className="text-sm font-medium">Role</label>
        <select id={`${idPrefix}-role`} name="role" defaultValue={contact?.role ?? 'other'} className={FIELD}>
          {CONTACT_ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
      </div>
      <Field
        id={`${idPrefix}-languages`}
        name="languages"
        label="Languages"
        defaultValue={contact?.mixProfile ?? contact?.languages.join('+')}
        hint="Main language first, for example te+hi+en."
      />
      <Field
        id={`${idPrefix}-phone`}
        name="phone"
        label="Phone number"
        type="tel"
        hint="Adds this number to the person."
      />
      <Field id={`${idPrefix}-notes`} name="notes" label="Notes" defaultValue={contact?.notes} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={BUTTON} disabled={pending}>
          {pending ? 'Saving...' : contact ? 'Save person' : 'Add person'}
        </button>
        {saved && <p role="status" className="text-sm">Saved</p>}
      </div>
      {error && <p role="alert" className="break-words text-sm">{error}</p>}
    </form>
  )
}

interface FieldProps {
  id: string
  name: string
  label: string
  defaultValue?: string | null
  hint?: string
  type?: string
}

function Field({ id, name, label, defaultValue, hint, type = 'text' }: FieldProps) {
  const describedBy = hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        className={FIELD}
        aria-describedby={describedBy}
      />
      {hint && <p id={`${id}-hint`} className="text-xs">{hint}</p>}
    </div>
  )
}
