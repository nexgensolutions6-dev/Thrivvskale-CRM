/**
 * Unit tests for the outbox notices: "stuck" means the transport is failing, so
 * it says "retrying" and offers nothing destructive; a refusal alone is not
 * stuck. The dead-letter confirm must name the company and the outcome.
 */
import { describe, expect, it } from 'vitest'
import type { LogCallInput } from '@/lib/call/logCallInput'
import { isStuck, removeQuestion, waitingLabel } from '@/lib/offline/outboxStatus'

describe('isStuck', () => {
  it('is true only when a send failed in transport', () => {
    expect(isStuck({ sent: 0, failed: 1, refused: 0 })).toBe(true)
    expect(isStuck({ sent: 3, failed: 1, refused: 2 })).toBe(true)
  })

  it('is false when the flush finished, even with refusals', () => {
    expect(isStuck({ sent: 0, failed: 0, refused: 1 })).toBe(false)
    expect(isStuck({ sent: 2, failed: 0, refused: 0 })).toBe(false)
  })
})

describe('waitingLabel', () => {
  it('counts the waiting outcomes', () => {
    expect(waitingLabel(1)).toBe('1 outcome waiting to send')
    expect(waitingLabel(3)).toBe('3 outcomes waiting to send')
  })
})

describe('removeQuestion', () => {
  it('names the company and the outcome', () => {
    const question = removeQuestion({
      clientId: 'a',
      type: 'logCall',
      companyName: 'Acme Clinic',
      payload: { outcome: 'not_interested' } as LogCallInput,
      reason: 'no',
      refusedAt: 'now',
    })
    expect(question).toContain('Acme Clinic')
    expect(question).toContain('Not interested')
  })
})
