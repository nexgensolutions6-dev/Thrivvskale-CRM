'use client'

/**
 * The sheet that opens after a call: outcome buttons, call length, mix spoken,
 * optional pain point, objections or lost reason, and the next action pre-filled
 * from the next working slot. Builds one LogCallInput with one clientId, so a
 * double tap stays one call. "Didn't call" logs nothing. Used by LeadCallFlow.
 */
import { useEffect, useRef, useState } from 'react'
import { Surface } from '@/components/glass/Surface'
import { BUTTON, FIELD, MUTED } from '@/components/lead/styles'
import type { CallLead, CallObjection, CallPoint } from '@/lib/call/callScreen'
import { defaultNextActionType } from '@/lib/call/defaultNextAction'
import { fromLocalInput, toLocalInput } from '@/lib/call/localDateTime'
import { OUTCOMES, type LogCallInput, type NextActionType } from '@/lib/call/logCallInput'
import { OUTCOME_LABELS } from '@/lib/call/outcomeLabels'
import type { Mix, Outcome } from '@/lib/domain'
import type { OutboxOp } from '@/lib/offline/outbox'
import { MixChips } from './MixChips'
import { EMPTY_PAIN_DRAFT, PainPointForm, toPainPoint } from './PainPointForm'

export interface OutcomeSheetProps {
  lead: CallLead
  point: CallPoint
  openerId: string | null
  /** Seconds estimated from time away; null when the sheet was opened by hand. */
  estimatedSeconds: number | null
  objections: CallObjection[]
  /** A voice note is recording; saving now would cut it off. */
  saveBlocked: boolean
  onCancel: () => void
  onSubmit: (op: OutboxOp) => Promise<void>
}

export function OutcomeSheet(props: OutcomeSheetProps) {
  const { lead, point, openerId, estimatedSeconds, objections, saveBlocked, onCancel, onSubmit } = props
  const [clientId] = useState(() => crypto.randomUUID())
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [seconds, setSeconds] = useState(estimatedSeconds === null ? '' : String(estimatedSeconds))
  const [isEstimate, setIsEstimate] = useState(estimatedSeconds !== null)
  const [mix, setMix] = useState<Mix>(point.mix)
  const [pain, setPain] = useState(EMPTY_PAIN_DRAFT)
  const [objectionIds, setObjectionIds] = useState<string[]>([])
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

  function buildPayload(chosen: Outcome): LogCallInput | null {
    const dueAt = nextType === null ? null : fromLocalInput(nextDue)
    if (nextType !== null && dueAt === null) {
      setError('Choose a date for the next action.')
      return null
    }
    const durationSeconds = seconds.trim() === '' ? null : Number(seconds)
    return {
      clientId,
      companyId: lead.companyId,
      contactPointId: point.id,
      outcome: chosen,
      durationSeconds,
      durationIsEstimate: durationSeconds !== null && isEstimate,
      mixUsed: mix,
      objectionIds,
      lostReason: chosen === 'not_interested' ? lostReason : undefined,
      openerId: openerId ?? undefined,
      painPoint: toPainPoint(pain),
      nextAction: nextType !== null && dueAt !== null ? { type: nextType, dueAt } : undefined,
      occurredAt: new Date().toISOString(),
    }
  }

  async function save() {
    if (outcome === null) return
    const payload = buildPayload(outcome)
    if (payload === null) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ clientId, type: 'logCall', payload })
    } catch (failure) {
      console.error(`[OutcomeSheet] save the outcome for "${lead.name}" failed`, failure)
      setError('The outcome could not be saved. Try again.')
      setSaving(false)
    }
  }

  function toggleObjection(id: string) {
    setObjectionIds((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]))
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
                onChange={() => toggleObjection(objection.id)}
              />
              <span className="min-w-0 break-words">{objection.text}</span>
            </label>
          ))}
        </fieldset>
      )}

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

      {saveBlocked && <p className="text-sm">Finish the voice note before saving.</p>}
      {error && <p role="alert" className="break-words text-sm">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={BUTTON}
          disabled={outcome === null || saving || saveBlocked}
          onClick={() => void save()}
        >
          {saving ? 'Saving...' : 'Save outcome'}
        </button>
        <button type="button" className={BUTTON} disabled={saving} onClick={onCancel}>{"Didn't call"}</button>
      </div>
    </Surface>
  )
}
