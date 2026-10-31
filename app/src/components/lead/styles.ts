/**
 * Tailwind class strings shared by the lead screens' buttons, fields and chips
 * (never applied to a Surface itself). Used by the components in this folder
 * and the /leads pages, so a change to how a button looks happens in one place.
 */
export const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-current px-4 py-2 ' +
  'text-sm font-medium bg-[var(--glass-row-fill)] disabled:opacity-60'

export const FIELD =
  'min-h-11 w-full min-w-0 rounded-xl border border-current px-3 py-2 text-base bg-[var(--glass-row-fill)]'

export const CHIP =
  'inline-flex items-center rounded-full border border-current px-3 py-1 text-xs font-medium ' +
  'bg-[var(--glass-row-fill)]'

export const MUTED = 'text-[var(--glass-text-secondary)]'
