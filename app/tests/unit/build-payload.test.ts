/**
 * Unit tests for buildPayload: what the outcome sheet may queue. Anything the
 * server would refuse for good must stop here with a message, because a queued
 * outcome can no longer be corrected. An over-long estimate is dropped, not refused.
 */
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildPayload, usableEstimate, type CallDraft } from '@/lib/call/buildPayload'
import { MAX_DURATION_SECONDS, validateLogCallInput } from '@/lib/call/validateLogCallInput'

const NOW = new Date('2026-11-01T06:00:00.000Z')

function draft(overrides: Partial<CallDraft> = {}): CallDraft {
  return {
    clientId: randomUUID(),
    companyId: randomUUID(),
    contactPointId: randomUUID(),
    outcome: 'no_answer',
    secondsText: '20',
    isEstimate: true,
    mix: ['te', 'en'],
    objectionIds: [],
    lostReason: '',
    openerId: null,
    painPoint: undefined,
    nextType: null,
    nextDueLocal: '2026-11-03T11:00',
    now: NOW,
    ...overrides,
  }
}

function expectRefused(result: ReturnType<typeof buildPayload>, text: RegExp): void {
  if (result.ok) throw new Error('expected the draft to be refused')
  expect(result.message).toMatch(text)
  expect(result.message).not.toContain('[validateLogCallInput]')
}

describe('buildPayload', () => {
  it('builds a payload the server validator accepts unchanged', () => {
    const result = buildPayload(draft({ nextType: 'callback', outcome: 'callback' }))
    if (!result.ok) throw new Error(result.message)
    expect(result.payload.durationSeconds).toBe(20)
    expect(result.payload.durationIsEstimate).toBe(true)
    expect(result.payload.occurredAt).toBe(NOW.toISOString())
    expect(result.payload.nextAction?.type).toBe('callback')
    expect(validateLogCallInput(result.payload)).toEqual(result.payload)
  })

  it('treats a blank call length as no duration and not an estimate', () => {
    const result = buildPayload(draft({ secondsText: '  ' }))
    if (!result.ok) throw new Error(result.message)
    expect(result.payload).toMatchObject({ durationSeconds: null, durationIsEstimate: false })
  })

  it('drops an estimate over the maximum: a guess that long is meaningless', () => {
    const result = buildPayload(draft({ secondsText: String(MAX_DURATION_SECONDS + 1) }))
    if (!result.ok) throw new Error(result.message)
    expect(result.payload).toMatchObject({ durationSeconds: null, durationIsEstimate: false })
  })

  it('keeps an estimate of exactly the maximum', () => {
    const result = buildPayload(draft({ secondsText: String(MAX_DURATION_SECONDS) }))
    if (!result.ok) throw new Error(result.message)
    expect(result.payload.durationSeconds).toBe(MAX_DURATION_SECONDS)
  })

  it.each(['-1', '1.5', String(MAX_DURATION_SECONDS + 1), 'abc'])('refuses a typed length of %s', (secondsText) => {
    expectRefused(buildPayload(draft({ secondsText, isEstimate: false })), /Call length/)
  })

  it('refuses a control character pasted into the quote', () => {
    const painPoint = {
      processCategory: 'follow-ups', impact: 'time', severity: 3, quote: 'bad\u0007text',
    } as const
    expectRefused(buildPayload(draft({ painPoint })), /quote.*control character/i)
  })

  it('refuses a control character pasted into the tool name', () => {
    const painPoint = {
      processCategory: 'follow-ups', impact: 'time', severity: 3, currentTool: 'bad\u0001tool',
    } as const
    expectRefused(buildPayload(draft({ painPoint })), /tool.*control character/i)
  })

  it('refuses a control character in the lost reason', () => {
    const result = buildPayload(draft({ outcome: 'not_interested', lostReason: 'x\u0002' }))
    expectRefused(result, /lost reason.*control character/i)
  })

  it('ignores a lost reason on any other outcome', () => {
    const result = buildPayload(draft({ outcome: 'busy', lostReason: 'x\u0002' }))
    expect(result.ok).toBe(true)
  })

  it('asks for a date when the next action has none', () => {
    expectRefused(buildPayload(draft({ nextType: 'todo', nextDueLocal: '' })), /date/)
  })
})

describe('usableEstimate', () => {
  it('keeps a sensible estimate and drops null or an over-long one', () => {
    expect(usableEstimate(185)).toBe(185)
    expect(usableEstimate(null)).toBeNull()
    expect(usableEstimate(MAX_DURATION_SECONDS + 1)).toBeNull()
  })
})
