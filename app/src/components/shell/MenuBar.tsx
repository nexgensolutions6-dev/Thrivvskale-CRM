'use client'
/**
 * The top bar (glass level 1): quick add, the command palette button, today's
 * targets, sync status and a clock. Targets and sync show sample values from
 * lib/shell/placeholder-status.ts until their data exists. Mounted by the app layout.
 */
import { Surface } from '@/components/glass/Surface'
import { openPalette } from '@/lib/shell/palette-store'
import { PLACEHOLDER_NOTE, PLACEHOLDER_SYNC, PLACEHOLDER_TARGETS } from '@/lib/shell/placeholder-status'
import { Clock } from './Clock'

const BUTTON_CLASS =
  'flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm transition-colors ' +
  'hover:bg-black/5 dark:hover:bg-white/10 forced-colors:border'

const SAMPLE_HINT = 'Sample value: this is not connected to real data yet'

/** Quick add starts the palette on "add", which lists the ways to add leads. */
function openQuickAdd(): void {
  openPalette('add')
}

export function MenuBar() {
  const { callsDone, callsGoal } = PLACEHOLDER_TARGETS
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

      <div className="ml-auto flex items-center gap-3 text-sm">
        <span data-testid="targets" title={SAMPLE_HINT}>
          Calls <strong className="tabular-nums">{callsDone}/{callsGoal}</strong>{' '}
          <span className="sr-only text-xs text-(--glass-text-secondary) sm:not-sr-only">({PLACEHOLDER_NOTE})</span>
        </span>
        <span data-testid="sync-status" title={SAMPLE_HINT} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-emerald-600 forced-colors:bg-[CanvasText]" />
          <span className="sr-only sm:not-sr-only">
            {PLACEHOLDER_SYNC.label}{' '}
            <span className="text-xs text-(--glass-text-secondary)">({PLACEHOLDER_NOTE})</span>
          </span>
        </span>
        <Clock />
      </div>
    </Surface>
  )
}
