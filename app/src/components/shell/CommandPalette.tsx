'use client'
/**
 * The Cmd/Ctrl+K command palette: a modal search box over the commands in
 * lib/shell/commands.ts. Arrow keys move, Enter runs, Escape closes. Open state
 * lives in lib/shell/palette-store.ts so the menu bar can open it too.
 * Mounted once by the app layout.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { Surface } from '@/components/glass/Surface'
import { filterCommands } from '@/lib/shell/command-match'
import { listCommands, subscribeCommands, type Command } from '@/lib/shell/commands'
import { closePalette, getPaletteState, subscribePalette, togglePalette } from '@/lib/shell/palette-store'

function isPaletteShortcut(event: globalThis.KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k'
}

export function CommandPalette() {
  const state = useSyncExternalStore(subscribePalette, getPaletteState, getPaletteState)

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!isPaletteShortcut(event)) return
      event.preventDefault() // browsers use Ctrl+K for their own search box
      togglePalette()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Mounted only while open, so every opening starts fresh (empty selection, query from the store).
  return state.open ? <PaletteDialog key={state.query} initialQuery={state.query} /> : null
}

function PaletteDialog({ initialQuery }: { initialQuery: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listId = useId()
  const commands = useSyncExternalStore(subscribeCommands, listCommands, listCommands)
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(0)

  const results = filterCommands(commands, query)
  const active = results[Math.min(activeIndex, results.length - 1)]

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  function runCommand(command: Command) {
    closePalette()
    command.run()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (Math.min(current, results.length - 1) + step + results.length) % results.length)
    } else if (event.key === 'Enter' && active) {
      event.preventDefault()
      runCommand(active)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      onCancel={closePalette} // Escape
      onClick={(event) => event.target === event.currentTarget && closePalette()} // click on the dimmed area
      className="fixed inset-x-0 top-[12vh] bottom-auto mx-auto w-[min(92vw,36rem)] bg-transparent p-0
        text-inherit backdrop:bg-black/30"
    >
      <Surface level="L3" className="flex flex-col gap-2 p-3">
        <input
          autoFocus
          type="text"
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
          placeholder="Type a command..."
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl bg-transparent px-3 py-2 text-base outline-none"
        />
        <ul id={listId} role="listbox" aria-label="Commands" className="flex max-h-[50vh] flex-col overflow-y-auto">
          {results.map((command) => (
            <li
              key={command.id}
              id={`${listId}-${command.id}`}
              role="option"
              aria-selected={command === active}
              onMouseDown={(event) => event.preventDefault()} // keep focus in the input
              onClick={() => runCommand(command)}
              className="cursor-pointer rounded-xl px-3 py-2 text-base aria-selected:bg-black/10
                dark:aria-selected:bg-white/15 forced-colors:aria-selected:underline"
            >
              {command.label}
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p role="status" className="px-3 py-2 text-sm text-(--glass-text-secondary)">
            No command matches &ldquo;{query.trim()}&rdquo;.
          </p>
        )}
      </Surface>
    </dialog>
  )
}
