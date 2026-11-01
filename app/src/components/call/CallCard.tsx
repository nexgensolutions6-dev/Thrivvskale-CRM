'use client'

/**
 * The call card: one lead at a time with the big Call button for the chosen
 * number, the problem and offer, the opener picker and the objection drawer. On wide screens it offers
 * a QR code so a phone can place the call. Used by LeadCallFlow.
 */
import Link from 'next/link'
import { useState } from 'react'
import { Surface } from '@/components/glass/Surface'
import { OpenerPicker } from '@/components/lead/OpenerPicker'
import { BUTTON, FIELD, MUTED } from '@/components/lead/styles'
import type { CallLead, CallObjection, CallPoint } from '@/lib/call/callScreen'
import { telHref } from '@/lib/call/telLink'
import { ObjectionDrawer } from './ObjectionDrawer'
import { TelQr } from './TelQr'

export interface CallCardProps {
  lead: CallLead
  point: CallPoint
  objections: CallObjection[]
  objectionIds: string[]
  onToggleObjection: (objectionId: string) => void
  onChoosePoint: (pointId: string) => void
  onChooseOpener: (openerId: string) => void
  /** The Call button was pressed: the dialer is about to open. */
  onCallPressed: () => void
  /** For when the app cannot see the call happen, as with a QR scan. */
  onLogOutcome: () => void
}

export function CallCard(props: CallCardProps) {
  const { lead, point, objections, objectionIds, onToggleObjection } = props
  const { onChoosePoint, onChooseOpener, onCallPressed, onLogOutcome } = props
  const [showQr, setShowQr] = useState(false)
  const href = telHref(point.e164)
  const place = [lead.vertical, lead.area].filter(Boolean).join(' · ')

  return (
    <Surface level="L3" className="flex flex-col gap-5 p-6">
      <div>
        <h2 className="break-words text-2xl font-semibold">{lead.name}</h2>
        {place && <p className={`break-words text-sm ${MUTED}`}>{place}</p>}
        <Link href={`/leads/${lead.companyId}`} className="text-sm underline">Open lead</Link>
      </div>

      {lead.points.length > 1 && (
        <label className="grid max-w-sm gap-1 text-sm">
          Number to call
          <select className={FIELD} value={point.id} onChange={(event) => onChoosePoint(event.target.value)}>
            {lead.points.map((option) => (
              <option key={option.id} value={option.id}>{`${option.owner}: ${option.e164}`}</option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <a href={href} className={`${BUTTON} min-w-44 text-lg`} onClick={onCallPressed}>
          {`Call ${point.owner}`}
        </a>
        <span className={MUTED}>{point.e164}</span>
        <button type="button" className={BUTTON} onClick={onLogOutcome}>Log an outcome</button>
        <button
          type="button"
          className={`${BUTTON} hidden md:inline-flex`}
          aria-expanded={showQr}
          onClick={() => setShowQr((shown) => !shown)}
        >
          Show QR for my phone
        </button>
      </div>
      {showQr && <TelQr href={href} />}

      {lead.problemEvidence && (
        <section aria-labelledby="problem-heading">
          <h2 id="problem-heading" className="text-lg font-semibold">Problem / Evidence</h2>
          <p className="break-words">{lead.problemEvidence}</p>
        </section>
      )}
      {lead.entryOffer && (
        <section aria-labelledby="offer-heading">
          <h2 id="offer-heading" className="text-lg font-semibold">Entry offer</h2>
          <p className="break-words">{lead.entryOffer}</p>
        </section>
      )}
      <OpenerPicker openers={lead.openers} points={lead.points} mixLabel={lead.mixLabel} onSelect={onChooseOpener} />
      <ObjectionDrawer objections={objections} mix={point.mix} selectedIds={objectionIds} onToggle={onToggleObjection} />
    </Surface>
  )
}
