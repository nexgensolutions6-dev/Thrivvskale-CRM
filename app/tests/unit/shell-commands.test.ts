import { beforeEach, describe, expect, it, vi } from 'vitest'
import { filterCommands } from '@/lib/shell/command-match'
import { listCommands, registerCommand, resetCommandsForTests, subscribeCommands } from '@/lib/shell/commands'

const noop = () => {}

beforeEach(() => resetCommandsForTests())

describe('registerCommand', () => {
  it('adds a command and returns a function that removes it', () => {
    const unregister = registerCommand({ id: 'a', label: 'Alpha', run: noop })
    expect(listCommands().map((c) => c.id)).toEqual(['a'])
    unregister()
    expect(listCommands()).toEqual([])
  })

  it('keeps registration order', () => {
    registerCommand({ id: 'b', label: 'Beta', run: noop })
    registerCommand({ id: 'a', label: 'Alpha', run: noop })
    expect(listCommands().map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('replaces a command registered again under the same id, in place', () => {
    registerCommand({ id: 'a', label: 'First', run: noop })
    registerCommand({ id: 'b', label: 'Second', run: noop })
    registerCommand({ id: 'a', label: 'First v2', run: noop })
    expect(listCommands().map((c) => c.label)).toEqual(['First v2', 'Second'])
  })

  it('an old unregister function does not remove its replacement', () => {
    const unregisterOld = registerCommand({ id: 'a', label: 'Old', run: noop })
    registerCommand({ id: 'a', label: 'New', run: noop })
    unregisterOld()
    expect(listCommands().map((c) => c.label)).toEqual(['New'])
  })

  it('calling unregister twice is harmless', () => {
    const unregister = registerCommand({ id: 'a', label: 'Alpha', run: noop })
    unregister()
    expect(() => unregister()).not.toThrow()
  })

  it('names the module and step when the command is malformed', () => {
    expect(() => registerCommand({ id: '', label: 'x', run: noop })).toThrow(
      /\[shell\/commands\] register command failed/,
    )
    expect(() => registerCommand({ id: 'x', label: '  ', run: noop })).toThrow(/label/)
  })

  it('returns a new array each time the list changes, so React can see it', () => {
    const before = listCommands()
    registerCommand({ id: 'a', label: 'Alpha', run: noop })
    expect(listCommands()).not.toBe(before)
    expect(listCommands()).toBe(listCommands())
  })
})

describe('subscribeCommands', () => {
  it('tells listeners about changes until they unsubscribe', () => {
    const listener = vi.fn()
    const stop = subscribeCommands(listener)
    const unregister = registerCommand({ id: 'a', label: 'Alpha', run: noop })
    unregister()
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    registerCommand({ id: 'b', label: 'Beta', run: noop })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('filterCommands', () => {
  const commands = [
    { id: 'go-today', label: 'Go to Today', run: noop },
    { id: 'go-leads', label: 'Go to Leads', run: noop },
    { id: 'import', label: 'Import leads from CSV', run: noop },
    { id: 'settings', label: 'Open settings', run: noop },
  ]

  it('returns everything for an empty or blank query', () => {
    expect(filterCommands(commands, '')).toEqual(commands)
    expect(filterCommands(commands, '   ')).toEqual(commands)
  })

  it('matches case-insensitively on the label', () => {
    expect(filterCommands(commands, 'LEADS').map((c) => c.id)).toEqual(['go-leads', 'import'])
  })

  it('needs every word of the query to appear', () => {
    expect(filterCommands(commands, 'import csv').map((c) => c.id)).toEqual(['import'])
    expect(filterCommands(commands, 'import today')).toEqual([])
  })

  it('puts labels that start with the query first, then word starts, then the rest', () => {
    const list = [
      { id: 'c', label: 'Backlog', run: noop },
      { id: 'b', label: 'Open log', run: noop },
      { id: 'a', label: 'Log out', run: noop },
    ]
    expect(filterCommands(list, 'log').map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps registration order between equal matches', () => {
    expect(filterCommands(commands, 'go').map((c) => c.id)).toEqual(['go-today', 'go-leads'])
  })
})
