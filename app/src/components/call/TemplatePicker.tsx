'use client'

/**
 * The outcome sheet's WhatsApp follow-up picker: choose a template, see it
 * filled in for this lead and number, then open WhatsApp for that number (no
 * link for a landline). Used by OutcomeSheet.
 */
import { useState } from 'react'
import { BUTTON, CHIP, FIELD, MUTED } from '@/components/lead/styles'
import type { CallPoint, CallTemplate } from '@/lib/call/callScreen'
import { buildTemplateMessage } from '@/lib/content/buildTemplateMessage'
import { honorificFor } from '@/lib/language/honorific'

export interface TemplatePickerProps {
  templates: CallTemplate[]
  point: CallPoint
  companyName: string
}

export function TemplatePicker({ templates, point, companyName }: TemplatePickerProps) {
  const [templateId, setTemplateId] = useState('')
  if (templates.length === 0) return null

  const template = templates.find((option) => option.id === templateId)
  const who = {
    name: point.greetingName,
    company: companyName,
    honorific: honorificFor(point.mix[0] ?? 'en', 'formal'),
  }
  const message = template ? buildTemplateMessage(template, point, point.mix, who) : null

  return (
    <section aria-labelledby="template-heading" className="flex flex-col gap-2">
      <h3 id="template-heading" className="text-sm font-medium">WhatsApp follow-up</h3>
      <label className="grid max-w-sm gap-1 text-sm">
        Template
        <select className={FIELD} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          <option value="">Choose a template</option>
          {templates.map((option) => (
            <option key={option.id} value={option.id}>{option.title}</option>
          ))}
        </select>
      </label>
      {template && message === null && <p className="text-sm">This template has no version that fits this contact.</p>}
      {message && (
        <>
          <p data-testid="template-text" className="min-w-0 whitespace-pre-wrap break-words">{message.text}</p>
          {message.link === null ? (
            <p className={`text-sm ${MUTED}`}>This number cannot receive WhatsApp.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <a href={message.link.url} target="_blank" rel="noopener noreferrer" className={`${BUTTON} self-start`}>
                {`WhatsApp ${point.owner}`}
              </a>
              {message.link.copyOnly && <span className={CHIP}>Message too long: copy it, then paste in WhatsApp</span>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
