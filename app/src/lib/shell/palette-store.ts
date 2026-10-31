/**
 * Whether the command palette is open and what it starts with. A tiny store so the
 * menu bar buttons, the keyboard shortcut and the palette itself share one state.
 * Read with useSyncExternalStore in CommandPalette.tsx; changed by MenuBar.
 */

export interface PaletteState {
  open: boolean
  query: string
}

type Listener = () => void

const CLOSED: PaletteState = { open: false, query: '' }

let state: PaletteState = CLOSED
const listeners = new Set<Listener>()

function setState(next: PaletteState): void {
  if (next.open === state.open && next.query === state.query) return
  state = next
  for (const listener of listeners) listener()
}

export function getPaletteState(): PaletteState {
  return state
}

export function openPalette(query = ''): void {
  setState({ open: true, query })
}

export function closePalette(): void {
  setState(CLOSED)
}

export function togglePalette(): void {
  if (state.open) closePalette()
  else openPalette()
}

export function subscribePalette(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Unit tests only: back to closed, no listeners. */
export function resetPaletteForTests(): void {
  state = CLOSED
  listeners.clear()
}
