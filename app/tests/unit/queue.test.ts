import { describe, expect, it } from 'vitest'
import { dynamicScore } from '@/lib/queue/dynamicScore'
import { rankQueue, type QueueItem } from '@/lib/queue/rank'

const NOW = new Date('2026-10-31T10:00:00Z')

function item(overrides: Partial<QueueItem> & { companyId: string }): QueueItem {
  return {
    tier: 'core',
    priority: 'A',
    score: 50,
    dueAt: null,
    dnd: false,
    needsNumber: false,
    wrongNumber: false,
    vertical: 'Interiors & Modular',
    area: 'Hyderabad',
    mix: ['te', 'en'],
    websiteStatus: 'none',
    ...overrides,
  }
}

const ids = (items: QueueItem[]) => items.map((i) => i.companyId)

describe('rankQueue ordering', () => {
  it('puts a due item before any never-called item, whatever the tier', () => {
    const due = item({ companyId: 'due', tier: 'exploratory', priority: 'C', dueAt: new Date('2026-10-31T09:00:00Z') })
    const fresh = item({ companyId: 'fresh', tier: 'core', priority: 'A', score: 99 })
    expect(ids(rankQueue([fresh, due], { now: NOW }))).toEqual(['due', 'fresh'])
  })

  it('treats dueAt exactly equal to now as due', () => {
    const due = item({ companyId: 'due', tier: 'exploratory', dueAt: NOW })
    const fresh = item({ companyId: 'fresh' })
    expect(ids(rankQueue([fresh, due], { now: NOW }))).toEqual(['due', 'fresh'])
  })

  it('orders due items earliest-due first, then by companyId', () => {
    const later = item({ companyId: 'a', dueAt: new Date('2026-10-31T09:30:00Z') })
    const earlier = item({ companyId: 'c', dueAt: new Date('2026-10-31T08:00:00Z') })
    const tied = item({ companyId: 'b', dueAt: new Date('2026-10-31T08:00:00Z') })
    expect(ids(rankQueue([later, earlier, tied], { now: NOW }))).toEqual(['b', 'c', 'a'])
  })

  it('ranks never-called core before exploratory, then A before B before C, then higher score', () => {
    const items = [
      item({ companyId: 'explA', tier: 'exploratory', priority: 'A', score: 90 }),
      item({ companyId: 'coreC', priority: 'C', score: 90 }),
      item({ companyId: 'coreB', priority: 'B', score: 90 }),
      item({ companyId: 'coreA-low', priority: 'A', score: 10 }),
      item({ companyId: 'coreA-high', priority: 'A', score: 80 }),
    ]
    expect(ids(rankQueue(items, { now: NOW }))).toEqual([
      'coreA-high',
      'coreA-low',
      'coreB',
      'coreC',
      'explA',
    ])
  })

  it('breaks full ties by companyId and does not mutate the input', () => {
    const input = [item({ companyId: 'z' }), item({ companyId: 'a' })]
    const ranked = rankQueue(input, { now: NOW })
    expect(ids(ranked)).toEqual(['a', 'z'])
    expect(ids(input)).toEqual(['z', 'a'])
  })

  it('puts items scheduled for later after the never-called items', () => {
    const later = item({ companyId: 'later', dueAt: new Date('2026-11-01T09:00:00Z') })
    const fresh = item({ companyId: 'fresh', tier: 'exploratory', priority: 'C', score: 0 })
    expect(ids(rankQueue([later, fresh], { now: NOW }))).toEqual(['fresh', 'later'])
  })
})

describe('rankQueue exclusions', () => {
  it('drops dnd, needsNumber and wrongNumber items, even when due', () => {
    const due = new Date('2026-10-31T09:00:00Z')
    const items = [
      item({ companyId: 'ok' }),
      item({ companyId: 'dnd', dnd: true, dueAt: due }),
      item({ companyId: 'needs', needsNumber: true }),
      item({ companyId: 'wrong', wrongNumber: true }),
    ]
    expect(ids(rankQueue(items, { now: NOW }))).toEqual(['ok'])
  })
})

describe('rankQueue filters', () => {
  const items = [
    item({ companyId: 'int-hyd-te', vertical: 'Interiors & Modular', area: 'Hyderabad', mix: ['te', 'en'], websiteStatus: 'none' }),
    item({ companyId: 'clin-vzg-hi', vertical: 'Clinics, Diagnostics & Pharmacies', area: 'Vizag', mix: ['hi', 'te'], websiteStatus: 'live' }),
  ]

  it('filters by vertical', () => {
    expect(ids(rankQueue(items, { now: NOW, filters: { vertical: 'Interiors & Modular' } }))).toEqual(['int-hyd-te'])
  })

  it('filters by area', () => {
    expect(ids(rankQueue(items, { now: NOW, filters: { area: 'Vizag' } }))).toEqual(['clin-vzg-hi'])
  })

  it('filters by primary language (first language of the mix only)', () => {
    expect(ids(rankQueue(items, { now: NOW, filters: { primaryLang: 'te' } }))).toEqual(['int-hyd-te'])
  })

  it('filters by websiteStatus', () => {
    expect(ids(rankQueue(items, { now: NOW, filters: { websiteStatus: 'live' } }))).toEqual(['clin-vzg-hi'])
  })

  it('requires every given filter to match', () => {
    expect(ids(rankQueue(items, { now: NOW, filters: { area: 'Vizag', primaryLang: 'te' } }))).toEqual([])
  })

  it('treats undefined filters as no filter', () => {
    expect(rankQueue(items, { now: NOW, filters: { vertical: undefined } })).toHaveLength(2)
  })
})

describe('rankQueue input errors', () => {
  it('names the module and the company when dueAt is an invalid date', () => {
    const bad = item({ companyId: 'co-123', dueAt: new Date('nope') })
    expect(() => rankQueue([bad], { now: NOW })).toThrow(/\[queue\/rank\].*co-123/)
  })

  it('names the module when now is an invalid date', () => {
    expect(() => rankQueue([], { now: new Date('nope') })).toThrow(/\[queue\/rank\]/)
  })
})

describe('dynamicScore', () => {
  it('adds the intent boost and the interested bonus', () => {
    expect(dynamicScore(50, { intent: true, outcomes: ['interested'] })).toBe(75)
  })

  it('adds the meeting_booked bonus', () => {
    expect(dynamicScore(50, { intent: false, outcomes: ['meeting_booked'] })).toBe(70)
  })

  it('returns the base when there are no signals', () => {
    expect(dynamicScore(50, { intent: false, outcomes: [] })).toBe(50)
  })

  it('subtracts 2 per no_answer, so four lower the score by 8', () => {
    const outcomes = Array<'no_answer'>(4).fill('no_answer')
    expect(dynamicScore(50, { intent: false, outcomes })).toBe(42)
  })

  it('caps the no_answer penalty at 10', () => {
    const outcomes = Array<'no_answer'>(10).fill('no_answer')
    expect(dynamicScore(50, { intent: false, outcomes })).toBe(40)
  })

  it('subtracts 5 per gatekeeper, capped at 15', () => {
    expect(dynamicScore(50, { intent: false, outcomes: ['gatekeeper', 'gatekeeper'] })).toBe(40)
    const many = Array<'gatekeeper'>(6).fill('gatekeeper')
    expect(dynamicScore(50, { intent: false, outcomes: many })).toBe(35)
  })

  it('ignores outcomes that carry no weight', () => {
    expect(dynamicScore(50, { intent: false, outcomes: ['busy', 'callback', 'not_interested', 'wrong_number'] })).toBe(50)
  })

  it('throws naming the module when base is not a finite number', () => {
    expect(() => dynamicScore(Number.NaN, { intent: false, outcomes: [] })).toThrow(/\[queue\/dynamicScore\]/)
  })
})
