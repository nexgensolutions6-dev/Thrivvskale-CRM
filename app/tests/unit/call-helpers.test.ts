/**
 * Unit tests for the small pure call helpers: which next action an outcome
 * suggests, the tel: link, the QR matrix, the QueueItem built from a company
 * (flags, mix, dynamic score), and the callback slot for a lead.
 */
import { describe, expect, it } from 'vitest'
import { buildQueueItem, type QueueCompany } from '@/lib/call/buildQueueItem'
import { callbackSlotFor } from '@/lib/call/callbackSlot'
import { defaultNextActionType } from '@/lib/call/defaultNextAction'
import { qrModules } from '@/lib/call/qrModules'
import { telHref } from '@/lib/call/telLink'
import { PROCESS_CATEGORIES } from '@/lib/discovery/taxonomy'

const COMPANY: QueueCompany = {
  id: 'c1',
  tier: 'core',
  priority: 'B',
  base_score: 50,
  vertical: 'Coaching & Education',
  area: 'Ameerpet',
  website_status: 'No website',
  intent_signal: null,
  dnd: false,
  needs_number: false,
  wrong_number: false,
  last_contacted_at: null,
  next_action_at: null,
}
const CONTEXT = { outcomes: [], mix: ['te', 'en'] as ('te' | 'en')[], hasNumber: true }

describe('buildQueueItem', () => {
  it('copies the flags and the mix and treats a never-called lead as not due', () => {
    const item = buildQueueItem({ ...COMPANY, dnd: true, wrong_number: true }, CONTEXT)
    expect(item).toMatchObject({ dnd: true, wrongNumber: true, needsNumber: false, mix: ['te', 'en'], dueAt: null })
  })

  it('uses the dynamic score, not the base score', () => {
    const quiet = buildQueueItem(COMPANY, CONTEXT)
    const hot = buildQueueItem(COMPANY, { ...CONTEXT, outcomes: ['interested'] })
    expect(quiet?.score).toBe(50)
    expect(hot?.score).toBeGreaterThan(50)
    expect(buildQueueItem({ ...COMPANY, intent_signal: 'Hiring' }, CONTEXT)?.score).toBeGreaterThan(50)
  })

  it('falls back to English when the mix is empty', () => {
    expect(buildQueueItem(COMPANY, { ...CONTEXT, mix: [] })?.mix).toEqual(['en'])
  })

  it('marks a company with no phone number as needing one', () => {
    expect(buildQueueItem(COMPANY, { ...CONTEXT, hasNumber: false })?.needsNumber).toBe(true)
  })

  it('reads next_action_at as the due time', () => {
    const dueAt = '2026-11-03T05:30:00.000Z'
    const called = { ...COMPANY, last_contacted_at: '2026-11-01T05:30:00.000Z', next_action_at: dueAt }
    expect(buildQueueItem(called, CONTEXT)?.dueAt?.toISOString()).toBe(dueAt)
  })

  it('leaves out a called lead with nothing scheduled, so it cannot rank as never called', () => {
    const called = { ...COMPANY, last_contacted_at: '2026-11-01T05:30:00.000Z' }
    expect(buildQueueItem(called, CONTEXT)).toBeNull()
  })

  it('survives missing vertical, area and priority', () => {
    const blank = { ...COMPANY, vertical: null, area: null, priority: null, website_status: null }
    expect(buildQueueItem(blank, CONTEXT)).toMatchObject({ vertical: '', area: '', priority: 'C', websiteStatus: '' })
  })
})

describe('callbackSlotFor', () => {
  it('uses the vertical best window, skips Sunday and the state holiday', () => {
    // Saturday 2026-11-07 afternoon in Kolkata: Sunday is off, Monday 9th is the next working day.
    const from = new Date('2026-11-07T10:00:00.000Z')
    const slot = callbackSlotFor(from, { vertical: 'Coaching & Education', state: 'Telangana' }, {
      workingDays: [1, 2, 3, 4, 5, 6],
      holidays: [{ region: 'Telangana', date: '2026-11-09', name: 'Test holiday' }],
    })
    expect(slot.toISOString()).toBe('2026-11-10T05:30:00.000Z') // 11:00 Kolkata on Tuesday
  })

  it('uses the "other" window for an unknown or missing vertical', () => {
    const from = new Date('2026-11-02T04:00:00.000Z')
    const slot = callbackSlotFor(from, { vertical: null, state: null }, { workingDays: [1, 2, 3, 4, 5], holidays: [] })
    expect(slot.toISOString()).toBe('2026-11-03T05:30:00.000Z')
  })
})

describe('defaultNextActionType', () => {
  it.each([
    ['no_answer', 'callback'],
    ['busy', 'callback'],
    ['callback', 'callback'],
    ['gatekeeper', 'callback'],
    ['interested', 'callback'],
    ['meeting_booked', 'todo'],
    ['not_interested', null],
    ['wrong_number', null],
  ] as const)('%s suggests %s', (outcome, expected) => {
    expect(defaultNextActionType(outcome)).toBe(expected)
  })
})

describe('telHref', () => {
  it('builds a tel: link from a stored number', () => {
    expect(telHref('+919866139900')).toBe('tel:+919866139900')
  })

  it('normalises a number that is not yet E.164', () => {
    expect(telHref('98661 39900')).toBe('tel:+919866139900')
  })
})

describe('qrModules', () => {
  it('returns a square matrix of dark and light cells', () => {
    const rows = qrModules('tel:+919866139900')
    expect(rows.length).toBeGreaterThan(20)
    expect(rows.every((row) => row.length === rows.length)).toBe(true)
    expect(rows[0][0]).toBe(true) // finder pattern corner
  })
})

describe('PROCESS_CATEGORIES', () => {
  it('holds the nine agreed categories', () => {
    expect(PROCESS_CATEGORIES).toEqual([
      'enquiry handling', 'appointments/booking', 'follow-ups', 'billing & fee collection',
      'inventory/stock', 'quotations', 'attendance', 'reporting', 'other',
    ])
  })
})
