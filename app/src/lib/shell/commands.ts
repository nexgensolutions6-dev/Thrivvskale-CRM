/**
 * The command registry behind the Cmd/Ctrl+K palette. Screens call
 * registerCommand() when they appear and the returned function when they go;
 * the palette (components/shell/CommandPalette.tsx) lists and runs what is registered.
 */
import { stepError } from '@/lib/step-error'

const MODULE = 'shell/commands'

export interface Command {
  id: string
  label: string
  run: () => void
}

type Listener = () => void

let commands: readonly Command[] = []
const listeners = new Set<Listener>()

function publish(next: readonly Command[]): void {
  commands = next // a new array each time, so useSyncExternalStore sees the change
  for (const listener of listeners) listener()
}

/** Registers a command and returns the function that removes it. Same id again replaces it in place. */
export function registerCommand(command: Command): () => void {
  if (command.id.trim() === '') throw stepError(MODULE, 'register command', 'id is empty')
  if (command.label.trim() === '') throw stepError(MODULE, 'register command', `label is empty (id "${command.id}")`)

  const index = commands.findIndex((existing) => existing.id === command.id)
  if (index === -1) publish([...commands, command])
  else publish(commands.map((existing, i) => (i === index ? command : existing)))

  return () => {
    // Only remove our own entry: a newer command with the same id must survive.
    if (commands.includes(command)) publish(commands.filter((existing) => existing !== command))
  }
}

export function listCommands(): readonly Command[] {
  return commands
}

export function subscribeCommands(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Unit tests only: start from an empty registry. */
export function resetCommandsForTests(): void {
  commands = []
  listeners.clear()
}
