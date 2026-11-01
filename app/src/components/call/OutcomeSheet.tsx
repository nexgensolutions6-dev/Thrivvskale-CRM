'use client'

/**
 * The sheet that opens after a call: outcome buttons, call length, mix spoken,
 * optional pain point, objections, a WhatsApp follow-up template, lost reason,
 * and the next action pre-filled from the next working slot. Builds one LogCallInput with one clientId, so a
 * double tap stays one call. buildPayload checks it before it is queued. "Didn't
 * call" logs nothing. Used by LeadCallFlow.
 */
import { useEffect, useRef, useState } from 'react'
import { Surface } from '@/components/glass/Surface'
import { BUTTON, FIELD, MUTED } from '@/components/lead/styles'
import type { CallLead, CallObjection, CallPoint, CallTemplate } from '@/lib/call/callScreen'
import { buildPayload, usableEstimate } from '@/lib/call/buildPayload'
import { defaultNextActionType } from '@/lib/call/defaultNextAction'
import { toLocalInput } from '@/lib/call/localDateTime'
import { OUTCOMES, type NextActionType } from '@/lib/call/logCallInput'
import { OUTCOME_LABELS } from '@/lib/call/outcomeLabels'
import type { Mix, Outcome } from '@/lib/domain'
import type { OutboxOp } from '@/lib/offline/outbox'
import { MixChips } from './MixChips'
import { EMPTY_PAIN_DRAFT, PainPointForm, toPainPoint } from './PainPointForm'
import { TemplatePicker } from './TemplatePicker'

const MODULE = 'OutcomeSheet'

export interface OutcomeSheetProps {
  lead: CallLead
  point: CallPoint
  openerId: string | null
  /** Seconds estimated from time away; null when the sheet was opened by hand. */
  estimatedSeconds: number | null
  objections: CallObjection[]
  templates: CallTemplate[]
  /** Objections chosen so far (in the drawer or here); kept by LeadCallFlow. */
  objectionIds: string[]
  onToggleObjection: (objectionId: string) => void
  /** Why saving must wait for the voice note, or null. Saving now would lose the note. */
  saveBlock: string | null
  onCancel: () => void
  onSubmit: (op: OutboxOp) => Promise<void>
}

export function OutcomeSheet(props: OutcomeSheetProps) {
  const { lead, point, openerId, objections, templates, objectionIds, onToggleObjection } = props
  const { saveBlock, onCancel, onSubmit } = props
  const estimatedSeconds = usableEstimate(props.estimatedSeconds)
  const [clientId] = useState(() => crypto.randomUUID())
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [seconds, setSeconds] = useState(estimatedSeconds === null ? '' : String(estimatedSeconds))
  const [isEstimate, setIsEstimate] = useState(estimatedSeconds !== null)
  const [mix, setMix] = useState<Mix>(point.mix)
  const [pain, setPain] = useState(EMPTY_PAIN_DRAFT)
  const [lostReason, setLostReason] = useState('')
  const [nextType, setNextType] = useState<NextActionType | null>(null)
  const [nextDue, setNextDue] = useState(() => toLocalInput(lead.callbackDefault))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => heading.current?.focus(), [])

  function chooseOutcome(chosen: Outcome) {
    setOutcome(chosen)
    setNextType(defaultNextActionType(chosen))
    setError(null)
  }

  async function save() {
    if (outcome === null) return
    const built = buildPayload({
      clientId,
      companyId: lead.companyId,
      contactPointId: point.id,
      outcome,
      secondsText: seconds,
      isEstimate,
      mix,
      objectionIds,
      lostReason,
      openerId,
      painPoint: toPainPoint(pain),
      nextType,
      nextDueLocal: nextDue,
      now: new Date(),
    })
    if (!built.ok) {
      setError(built.message)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ clientId, type: 'logCall', companyName: lead.name, payload: built.payload })
    } catch (failure) {
      console.error(`[${MODULE}] save the outcome for "${lead.name}" failed`, failure)
      setError('The outcome could not be saved. Try again.')
      setSaving(false)
    }
  }

  return (
    <Surface level="L3" role="dialog" aria-labelledby="outcome-heading" className="flex flex-col gap-5 p-6">
      <h2 id="outcome-heading" ref={heading} tabIndex={-1} className="break-words text-2xl font-semibold">
        How did the call with {lead.name} go?
      </h2>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Outcome">
        {OUTCOMES.map((option) => (
          <button
            key={option}
            type="button"
            className={BUTTON}
            aria-pressed={outcome === option}
            onClick={() => chooseOutcome(option)}
          >
            {OUTCOME_LABELS[option]}
          </button>
        ))}
      </div>

      <label className="grid max-w-xs gap-1 text-sm">
        Call length (seconds)
        <input
          className={FIELD}
          type="number"
          min={0}
          max={14400}
          inputMode="numeric"
          value={seconds}
          onChange={(event) => {
            setSeconds(event.target.value)
            setIsEstimate(false)
          }}
        />
        {isEstimate && <span className={MUTED}>Estimated from time away</span>}
      </label>

      <MixChips value={mix} onChange={setMix} />
      <PainPointForm value={pain} onChange={setPain} />

      {objections.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Objections</legend>
          {objections.map((objection) => (
            <label key={objection.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={objectionIds.includes(objection.id)}
                onChange={() => onToggleObjection(objection.id)}
              />
              <span className="min-w-0 break-words">{objection.text}</span>
            </label>
          ))}
        </fieldset>
      )}

      <TemplatePicker templates={templates} point={point} companyName={lead.name} />

      {outcome === 'not_interested' && (
        <label className="grid gap-1 text-sm">
          Lost reason
          <input
            className={FIELD}
            maxLength={500}
            value={lostReason}
            onChange={(event) => setLostReason(event.target.value)}
          />
        </label>
      )}

      {outcome !== null && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Next action
            <select
              className={FIELD}
              value={nextType ?? ''}
              onChange={(event) => setNextType((event.target.value || null) as NextActionType | null)}
            >
              {outcome !== 'callback' && <option value="">None</option>}
              <option value="callback">Callback</option>
              <option value="todo">To-do</option>
            </select>
          </label>
          {nextType !== null && (
            <label className="grid gap-1 text-sm">
              When
              <input
                className={FIELD}
                type="datetime-local"
                value={nextDue}
                onChange={(event) => setNextDue(event.target.value)}
              />
            </label>
          )}
        </div>
      )}

      {saveBlock && <p className="text-sm">{saveBlock}</p>}
      {error && <p role="alert" className="break-words text-sm">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={BUTTON}
          disabled={outcome === null || saving || saveBlock !== null}
          onClick={() => void save()}
        >
          {saving ? 'Saving...' : 'Save outcome'}
        </button>
        <button type="button" className={BUTTON} disabled={saving} onClick={onCancel}>{"Didn't call"}</button>
      </div>
    </Surface>
  )
}
