'use client'

/**
 * The daily targets form: three whole numbers and a Save button. Shows "Targets
 * saved" or the reason it was refused. Calls saveTargetsAction. Used by the
 * Targets page.
 */
import { useActionState } from 'react'
import type { TargetValues } from '@/lib/scoreboard/types'
import { saveTargetsAction } from './actions'
import { IDLE_STATE } from './targets-result'

const FIELDS: ReadonlyArray<readonly [keyof TargetValues, string]> = [
  ['calls', 'Calls per day'],
  ['conversations', 'Conversations per day'],
  ['demos', 'Demos per day'],
]

const INPUT_CLASS = 'w-full rounded-lg border border-current bg-transparent px-3 py-2 tabular-nums'

export function TargetsForm({ current }: { current: TargetValues }) {
  const [state, formAction, pending] = useActionState(saveTargetsAction, IDLE_STATE)
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {FIELDS.map(([key, label]) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="font-medium">{label}</span>
          <input name={key} inputMode="numeric" defaultValue={current[key]} className={INPUT_CLASS} />
        </label>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-current px-5 py-2 font-semibold"
      >
        {pending ? 'Saving...' : 'Save targets'}
      </button>
      {state.status === 'saved' && <p role="status">Targets saved.</p>}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
    </form>
  )
}
