'use client'

/**
 * The opener picker: the lead's call openers in the primary contact's
 * language mix (best match first), the chosen one with its name filled in,
 * a Copy button, and a WhatsApp button for every number that can get one
 * (landlines get none). An opener that cannot be filled safely shows a plain
 * message and no actions. Used by the /leads/[id] page and the call card; both prepare the
 * texts on the server.
 */
import { useState } from 'react'
import type { PickerOpener, PickerPoint } from '@/lib/leads/openerChoices'
import { buildWaLink } from '@/lib/whatsapp/link'
import { BUTTON, CHIP, MUTED } from './styles'

export interface OpenerPickerProps {
  openers: PickerOpener[]
  points: PickerPoint[]
  mixLabel: string
  /** Told which opener is chosen; the call flow logs it with the call. */
  onSelect?: (openerId: string) => void
}

export function OpenerPicker({ openers, points, mixLabel, onSelect }: OpenerPickerProps) {
  const [selectedId, setSelectedId] = useState(openers[0]?.id ?? '')
  const selected = openers.find((opener) => opener.id === selectedId) ?? openers[0] ?? null

  return (
    <section aria-labelledby="opener-heading" className="flex flex-col gap-3">
      <h2 id="opener-heading" className="text-lg font-semibold">Opener</h2>
      <p className={`text-sm ${MUTED}`}>Language mix: {mixLabel}</p>
      {selected === null ? (
        <p>No opener matches this mix yet.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2" aria-label="Openers">
            {openers.map((opener, index) => (
              <li key={opener.id}>
                <button
                  type="button"
                  className={BUTTON}
                  aria-pressed={opener.id === selected.id}
                  onClick={() => {
                    setSelectedId(opener.id)
                    onSelect?.(opener.id)
                  }}
                >
                  {`Opener ${index + 1} (${opener.mixLabel}, ${opener.matchLabel})`}
                </button>
              </li>
            ))}
          </ul>
          {selected.text === null ? (
            <p data-testid="opener-text" className="text-lg">This opener cannot be filled in for this lead yet.</p>
          ) : (
            <OpenerActions key={selected.id} text={selected.text} points={points} />
          )}
        </>
      )}
    </section>
  )
}

function OpenerActions({ text, points }: { text: string; points: PickerPoint[] }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch (error) {
      console.error('[OpenerPicker] copy failed', error)
      setCopied(false)
    }
  }

  return (
    <>
      <p data-testid="opener-text" className="min-w-0 whitespace-pre-wrap break-words text-lg">{text}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON} onClick={copy}>Copy opener</button>
        {copied && <span role="status" className="text-sm">Copied</span>}
        {points.map((point) => (
          <WhatsAppButton key={point.id} point={point} text={text} />
        ))}
      </div>
    </>
  )
}

/** Nothing at all for a landline or a number known to have no WhatsApp: no button, no dead link. */
function WhatsAppButton({ point, text }: { point: PickerPoint; text: string }) {
  const link = buildWaLink(point, text)
  if (link === null) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a href={link.url} target="_blank" rel="noopener noreferrer" className={BUTTON}>
        {`WhatsApp ${point.owner}`}
      </a>
      {link.copyOnly && <span className={CHIP}>Message too long: copy it, then paste in WhatsApp</span>}
    </span>
  )
}
