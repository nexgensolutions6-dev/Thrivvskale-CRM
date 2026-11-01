'use client'
/**
 * The top bar (glass level 1): quick add, the command palette button, today's
 * targets, sync status and a clock. Targets are real numbers passed in by the
 * app layout; the sync chip still shows a sample value (lib/shell/placeholder-status.ts).
 */
import { Surface } from '@/components/glass/Surface'
import { openPalette } from '@/lib/shell/palette-store'
import type { MenuTargets } from '@/lib/shell/loadMenuTargets'
import { PLACEHOLDER_NOTE, PLACEHOLDER_SYNC, SYNC_IS_PLACEHOLDER } from '@/lib/shell/placeholder-status'
import { Clock } from './Clock'

// Every label sits on an opaque chip, not on the L1 blur (why: lib/shell/menu-bar-text.ts). The tokens are
// spelled out in full so Tailwind finds them; menu-bar-contrast.test.ts checks they match that file.
const CHIP_CLASS =
  'whitespace-nowrap rounded-full bg-(--glass-l2-solid) text-(--glass-text) forced-colors:bg-[Canvas] forced-colors:border'

const BUTTON_CLASS =
  `${CHIP_CLASS} flex h-9 min-w-9 items-center justify-center px-2 text-sm transition-[filter] ` +
  'hover:brightness-95 dark:hover:brightness-125'

const SAMPLE_HINT = 'Sample value: sync status is not connected to real data yet'

// Muted ring while the data is made up; a solid green dot only once a real sync reports.
const DOT_PLACEHOLDER = 'size-2 rounded-full border border-current opacity-60'
const DOT_LIVE = 'size-2 rounded-full bg-emerald-600 forced-colors:bg-[CanvasText]'

/** Compact "sample" marker, shown at every width, next to any made-up value. */
function SampleTag() {
  return <span className="text-xs italic">{PLACEHOLDER_NOTE}</span>
}

/** Quick add starts the palette on "add", which lists the ways to add leads. */
function openQuickAdd(): void {
  openPalette('add')
}

/** "Calls 3/40", or just "Calls 3" when no goal is set (or the numbers could not be read). */
function TargetsText({ targets }: { targets: MenuTargets | null }) {
  if (targets === null) return <>Calls</>
  const { callsDone, callsGoal } = targets
  return <>Calls <strong className="tabular-nums">{callsGoal > 0 ? `${callsDone}/${callsGoal}` : callsDone}</strong></>
}

export function MenuBar({ targets }: { targets: MenuTargets | null }) {
  return (
    <Surface
      level="L1"
      role="banner"
      data-testid="menu-bar"
      className="fixed inset-x-3 top-3 z-30 flex h-12 items-center gap-1 px-2 md:inset-x-4 md:top-4"
    >
      <button type="button" aria-label="Quick add" onClick={openQuickAdd} className={BUTTON_CLASS}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Open command palette"
        title="Command palette (Cmd+K or Ctrl+K)"
        onClick={() => openPalette()}
        className={BUTTON_CLASS}
      >
        <kbd className="font-sans">⌘K</kbd>
      </button>

      <div className={`${CHIP_CLASS} ml-auto flex h-9 items-center gap-3 px-3 text-sm`}>
        <span data-testid="targets">
          <TargetsText targets={targets} />
        </span>
        <span
          data-testid="sync-status"
          data-placeholder={SYNC_IS_PLACEHOLDER}
          title={SYNC_IS_PLACEHOLDER ? SAMPLE_HINT : undefined}
          className="flex items-center gap-1.5"
        >
          <span aria-hidden="true" className={SYNC_IS_PLACEHOLDER ? DOT_PLACEHOLDER : DOT_LIVE} />
          <span className="sr-only sm:not-sr-only">{PLACEHOLDER_SYNC.label}</span>{' '}
          {SYNC_IS_PLACEHOLDER && <SampleTag />}
        </span>
        <Clock />
      </div>
    </Surface>
  )
}
