/**
 * Unit tests for the pure parts of the Today screen: which days the week shows,
 * how due items are ordered and badged, and day labels.
 */
import { describe, expect, it } from 'vitest'
import { dayLabel } from '@/lib/today/dayLabel'
import { sortDue } from '@/lib/today/sortDue'
import type { TodayTask } from '@/lib/today/types'
import { weekDays } from '@/lib/today/weekDays'

function task(id: string, type: TodayTask['type'], dueAt: string): TodayTask {
  return { id, type, title: id, dueAt: new Date(dueAt), companyId: null, companyName: null }
}

describe('weekDays', () => {
  it('is Monday to Saturday of the week containing the day', () => {
    expect(weekDays('2026-10-28')).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31',
    ])
    expect(weekDays('2026-10-26')[0]).toBe('2026-10-26')
    expect(weekDays('2026-10-31')[5]).toBe('2026-10-31')
  })

  it('shows the coming week on a Sunday', () => {
    expect(weekDays('2026-11-01')[0]).toBe('2026-11-02')
  })
})

describe('sortDue', () => {
  const now = new Date('2026-11-03T08:00:00Z')

  it('puts callbacks before tasks, oldest first, and drops items not yet due', () => {
    const items = sortDue([
      task('todo-early', 'todo', '2026-11-03T03:30:00Z'),
      task('callback-late', 'callback', '2026-11-03T05:00:00Z'),
      task('callback-early', 'callback', '2026-11-03T04:00:00Z'),
      task('future', 'todo', '2026-11-03T09:00:00Z'),
    ], now)
    expect(items.map((item) => item.id)).toEqual(['callback-early', 'callback-late', 'todo-early'])
  })

  it('marks an item from an earlier Kolkata day overdue, and one from today due now', () => {
    const [overdue, dueNow] = sortDue([
      task('old', 'callback', '2026-11-02T10:00:00Z'),
      task('today', 'callback', '2026-11-03T06:00:00Z'),
    ], now)
    expect([overdue.badge, dueNow.badge]).toEqual(['overdue', 'due now'])
  })
})

describe('dayLabel', () => {
  it('reads like "Mon 3 Nov"', () => {
    expect(dayLabel('2026-11-02')).toBe('Mon 2 Nov')
    expect(dayLabel('2026-10-31')).toBe('Sat 31 Oct')
  })
})
