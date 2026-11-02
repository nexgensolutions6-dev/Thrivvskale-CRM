'use client'

/**
 * Optional pain-point capture inside the outcome sheet: process, current tool,
 * impact, severity and the prospect's own words. Nothing is saved until a process
 * is chosen. `toPainPoint` turns the draft into the logCall field. Used by OutcomeSheet.
 */
import { FIELD } from '@/components/lead/styles'
import type { Impact, PainPointInput } from '@/lib/call/logCallInput'
import { IMPACTS } from '@/lib/call/logCallInput'
import { PROCESS_CATEGORIES } from '@/lib/discovery/taxonomy'

const SEVERITIES = [1, 2, 3, 4, 5] as const

export interface PainDraft {
  processCategory: string
  currentTool: string
  impact: Impact
  severity: PainPointInput['severity']
  quote: string
}

export const EMPTY_PAIN_DRAFT: PainDraft = {
  processCategory: '',
  currentTool: '',
  impact: 'time',
  severity: 3,
  quote: '',
}

export function toPainPoint(draft: PainDraft): PainPointInput | undefined {
  if (draft.processCategory === '') return undefined
  return {
    processCategory: draft.processCategory,
    currentTool: draft.currentTool.trim() || undefined,
    impact: draft.impact,
    severity: draft.severity,
    quote: draft.quote === '' ? undefined : draft.quote,
  }
}

export function PainPointForm({ value, onChange }: { value: PainDraft; onChange: (draft: PainDraft) => void }) {
  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Add a pain point</summary>
      <div className="grid gap-3 pt-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Process
          <select
            className={FIELD}
            value={value.processCategory}
            onChange={(event) => onChange({ ...value, processCategory: event.target.value })}
          >
            <option value="">Choose a process</option>
            {PROCESS_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Current tool
          <input
            className={FIELD}
            maxLength={200}
            value={value.currentTool}
            onChange={(event) => onChange({ ...value, currentTool: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Impact
          <select
            className={FIELD}
            value={value.impact}
            onChange={(event) => onChange({ ...value, impact: event.target.value as Impact })}
          >
            {IMPACTS.map((impact) => <option key={impact} value={impact}>{impact}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Severity (1 to 5)
          <select
            className={FIELD}
            value={value.severity}
            onChange={(event) => {
              onChange({ ...value, severity: Number(event.target.value) as PainDraft['severity'] })
            }}
          >
            {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          In their own words
          <textarea
            className={FIELD}
            rows={3}
            maxLength={2000}
            value={value.quote}
            onChange={(event) => onChange({ ...value, quote: event.target.value })}
          />
        </label>
      </div>
    </details>
  )
}
