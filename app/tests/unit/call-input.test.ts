/**
 * Unit tests for the runtime checks in front of logCall and recordVoiceNote:
 * server actions are publicly callable, so a bad value must be refused by name.
 */
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { validateLogCallInput } from '@/lib/call/validateLogCallInput'
import { MAX_VOICE_NOTE_BYTES, validateVoiceNote } from '@/lib/call/validateVoiceNote'

function input(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientId: randomUUID(),
    companyId: randomUUID(),
    contactPointId: randomUUID(),
    outcome: 'interested',
    durationSeconds: 120,
    durationIsEstimate: true,
    mixUsed: ['te', 'en'],
    objectionIds: [],
    ...extra,
  }
}

describe('validateLogCallInput', () => {
  it('passes a good input through and drops unknown fields', () => {
    const clean = validateLogCallInput(input({ workspaceId: 'someone-elses', lostReason: '  too costly ' }))
    expect(clean.outcome).toBe('interested')
    expect(clean.lostReason).toBe('too costly')
    expect(clean).not.toHaveProperty('workspaceId')
  })

  it.each([
    ['clientId', { clientId: 'nope' }],
    ['companyId', { companyId: 7 }],
    ['contactPointId', { contactPointId: null }],
    ['outcome', { outcome: 'maybe' }],
    ['durationSeconds', { durationSeconds: -1 }],
    ['durationSeconds', { durationSeconds: 1.5 }],
    ['durationSeconds', { durationSeconds: 90_000 }],
    ['durationIsEstimate', { durationIsEstimate: 'yes' }],
    ['durationIsEstimate', { durationSeconds: null, durationIsEstimate: true }],
    ['mixUsed', { mixUsed: ['te', 'xx'] }],
    ['mixUsed', { mixUsed: 'te' }],
    ['mixUsed', { mixUsed: ['te', 'te'] }],
    ['objectionIds', { objectionIds: ['nope'] }],
    ['openerId', { openerId: 'nope' }],
    ['lostReason', { lostReason: 'x'.repeat(501) }],
    ['lostReason', { lostReason: 'null\u0000byte' }],
    ['occurredAt', { occurredAt: 'yesterday' }],
    ['nextAction', { nextAction: { type: 'demo', dueAt: '2026-11-03T05:30:00.000Z' } }],
    ['nextAction', { nextAction: { type: 'callback', dueAt: 'tomorrow' } }],
    ['nextAction', { outcome: 'callback' }],
    ['painPoint', { painPoint: { processCategory: 'made up', impact: 'time', severity: 3 } }],
    ['painPoint', { painPoint: { processCategory: 'reporting', impact: 'fame', severity: 3 } }],
    ['painPoint', { painPoint: { processCategory: 'reporting', impact: 'time', severity: 6 } }],
    ['painPoint', { painPoint: { processCategory: 'reporting', impact: 'time', severity: 2.5 } }],
  ])('refuses a bad %s', (field, extra) => {
    expect(() => validateLogCallInput(input(extra))).toThrow(field)
  })

  it('refuses something that is not an object', () => {
    expect(() => validateLogCallInput('nope')).toThrow(/validateLogCallInput/)
  })

  it('keeps a pain point quote verbatim, mixed language and all', () => {
    const quote = '  Sir, follow-up చేయడం కష్టం '
    const clean = validateLogCallInput(input({
      painPoint: { processCategory: 'follow-ups', impact: 'time', severity: 4, quote },
    }))
    expect(clean.painPoint?.quote).toBe(quote)
  })
})

describe('validateVoiceNote', () => {
  const WEBM_START = [0x1a, 0x45, 0xdf, 0xa3, 0x01]
  const blob = (bytes: number[], type = 'audio/webm;codecs=opus') => new Blob([new Uint8Array(bytes)], { type })
  const companyId = randomUUID()

  it('accepts webm audio', async () => {
    const clean = await validateVoiceNote(companyId, blob(WEBM_START))
    expect(clean.companyId).toBe(companyId)
    expect(clean.bytes).toBeInstanceOf(Uint8Array)
  })

  it('refuses a bad company id', async () => {
    await expect(validateVoiceNote('nope', blob(WEBM_START))).rejects.toThrow('companyId')
  })

  it('refuses a value that is not a Blob', async () => {
    await expect(validateVoiceNote(companyId, 'audio')).rejects.toThrow('audio')
  })

  it('refuses empty audio', async () => {
    await expect(validateVoiceNote(companyId, blob([]))).rejects.toThrow('empty')
  })

  it('refuses another file type', async () => {
    await expect(validateVoiceNote(companyId, blob(WEBM_START, 'text/html'))).rejects.toThrow('type')
  })

  it('refuses bytes that are not webm, whatever the label says', async () => {
    await expect(validateVoiceNote(companyId, blob([1, 2, 3, 4, 5]))).rejects.toThrow('webm')
  })

  it('refuses audio over the size cap', async () => {
    const big = new Blob([new Uint8Array(MAX_VOICE_NOTE_BYTES + 1)], { type: 'audio/webm' })
    await expect(validateVoiceNote(companyId, big)).rejects.toThrow('too large')
  })
})
