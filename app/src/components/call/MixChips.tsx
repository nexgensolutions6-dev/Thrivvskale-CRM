'use client'

/**
 * The "mix spoken" chips: one toggle per language. Tapping adds a language at
 * the end of the mix or removes it, so the first one tapped stays primary.
 * Used by OutcomeSheet.
 */
import { BUTTON } from '@/components/lead/styles'
import { LANG_CODES, type LangCode, type Mix } from '@/lib/domain'
import { LANGUAGE_LABELS } from '@/lib/call/outcomeLabels'

export function MixChips({ value, onChange }: { value: Mix; onChange: (mix: Mix) => void }) {
  function toggle(code: LangCode) {
    onChange(value.includes(code) ? value.filter((other) => other !== code) : [...value, code])
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Mix spoken</legend>
      <div className="flex flex-wrap gap-2">
        {LANG_CODES.map((code) => (
          <button
            key={code}
            type="button"
            className={BUTTON}
            aria-pressed={value.includes(code)}
            onClick={() => toggle(code)}
          >
            {LANGUAGE_LABELS[code]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
