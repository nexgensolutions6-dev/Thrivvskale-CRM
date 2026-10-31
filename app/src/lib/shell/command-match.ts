/**
 * Filters and ranks palette commands for what the user typed. Every word of the
 * query must appear in the label. Pure function; called by CommandPalette.
 */
import type { Command } from './commands'

/** 0 = label starts with the query, 1 = a word starts with it, 2 = it appears somewhere inside. */
function rank(label: string, query: string): number {
  if (label.startsWith(query)) return 0
  if (label.includes(` ${query}`)) return 1
  return 2
}

export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const text = query.trim().toLowerCase()
  if (text === '') return [...commands]

  const words = text.split(/\s+/)
  const matches: { command: Command; rank: number; order: number }[] = []
  commands.forEach((command, order) => {
    const label = command.label.toLowerCase()
    if (words.every((word) => label.includes(word))) matches.push({ command, rank: rank(label, text), order })
  })
  // Equal ranks keep registration order, so results do not jump around.
  matches.sort((a, b) => a.rank - b.rank || a.order - b.order)
  return matches.map((match) => match.command)
}
