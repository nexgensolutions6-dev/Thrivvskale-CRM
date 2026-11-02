/**
 * "People and numbers": each contact with their role (decision maker,
 * gatekeeper...), languages and phone numbers, the company lines, and forms
 * to add or edit a person. Server component; used by the /leads/[id] page.
 * Numbers are call links; a landline shows no WhatsApp button anywhere.
 */
import { ROLE_LABELS, WA_LABELS } from '@/lib/leads/labels'
import type { LeadContact, LeadPoint } from '@/lib/leads/leadView'
import { ContactForm } from './ContactForm'
import { CHIP, MUTED } from './styles'

export interface PeoplePanelProps {
  companyId: string
  contacts: LeadContact[]
  points: LeadPoint[]
}

export function PeoplePanel({ companyId, contacts, points }: PeoplePanelProps) {
  const companyLines = points.filter((point) => point.contactId === null)
  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-3">
      <h2 id="people-heading" className="text-lg font-semibold">People and numbers</h2>
      {contacts.length === 0 && companyLines.length === 0 && <p>No people or numbers yet.</p>}
      <ul className="flex flex-col gap-2">
        {contacts.map((contact) => (
          <PersonItem
            key={contact.id}
            companyId={companyId}
            contact={contact}
            points={points.filter((point) => point.contactId === contact.id)}
          />
        ))}
      </ul>
      {companyLines.length > 0 && (
        <div>
          <h3 className="font-medium">Company lines</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {companyLines.map((point) => (
              <NumberItem key={point.id} point={point} />
            ))}
          </ul>
        </div>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Add a person</summary>
        <div className="pt-2"><ContactForm companyId={companyId} /></div>
      </details>
    </section>
  )
}

function PersonItem(props: { companyId: string; contact: LeadContact; points: LeadPoint[] }) {
  const { contact } = props
  const shown = contact.name ?? contact.nameLatin ?? 'Unnamed'
  const showLatin = contact.name && contact.nameLatin && contact.nameLatin !== contact.name
  return (
    <li className="glass-row flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words font-medium">{shown}</span>
        {showLatin && <span className={`text-sm ${MUTED}`}>({contact.nameLatin})</span>}
        <span className={CHIP}>{ROLE_LABELS[contact.role]}</span>
        {contact.mixProfile && <span className={`text-sm ${MUTED}`}>{contact.mixProfile}</span>}
      </div>
      <ul className="flex flex-col gap-1">
        {props.points.map((point) => (
          <NumberItem key={point.id} point={point} />
        ))}
      </ul>
      {contact.notes && <p className={`break-words text-sm ${MUTED}`}>{contact.notes}</p>}
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">{`Edit ${shown}`}</summary>
        <div className="pt-2"><ContactForm companyId={props.companyId} contact={contact} /></div>
      </details>
    </li>
  )
}

function NumberItem({ point }: { point: LeadPoint }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <a href={`tel:${point.e164}`} className="min-h-11 content-center font-medium underline">{point.e164}</a>
      <span className={MUTED}>{WA_LABELS[point.waStatus]}</span>
    </li>
  )
}
