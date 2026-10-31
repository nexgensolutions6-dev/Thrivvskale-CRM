/**
 * Unit tests for refusalReason: a permanent "no" from the rules or the database
 * becomes a dead letter, while anything that may heal by itself stays a transport
 * failure that keeps retrying. Guessing wrong here loses or blocks real calls.
 */
import { describe, expect, it } from 'vitest'
import { refusalReason } from '@/lib/call/logCallRefusal'
import { validateLogCallInput } from '@/lib/call/validateLogCallInput'
import { stepError } from '@/lib/step-error'

describe('refusalReason', () => {
  it('refuses a validation failure', () => {
    let failure: unknown
    try {
      validateLogCallInput({})
    } catch (error) {
      failure = error
    }
    expect(refusalReason(failure)).toMatch(/validate outcome/)
  })

  it('refuses a rule failure, with the message naming module, step and company', () => {
    const error = stepError('logCallInWorkspace', 'read contact point of "Acme"', 'x is not its number')
    expect(refusalReason(error)).toContain('"Acme"')
  })

  it('refuses a log_call exception', () => {
    const cause = { code: 'P0001', message: '[log_call] check opener failed: x is not an opener usable on "Acme"' }
    expect(refusalReason(stepError('logCallInWorkspace', 'log call on "Acme"', cause))).toContain('opener')
  })

  it('refuses the log_call membership check but not any other permission error', () => {
    const member = { code: '42501', message: '[log_call] check membership failed: not a member' }
    expect(refusalReason(stepError('m', 'log call', member))).not.toBeNull()
    const rls = { code: '42501', message: 'permission denied for table calls' }
    expect(refusalReason(stepError('m', 'log call', rls))).toBeNull()
  })

  it.each(['23514', '23503', '22P02'])('refuses database rule violation %s', (code) => {
    expect(refusalReason(stepError('m', 'log call', { code, message: 'bad row' }))).not.toBeNull()
  })

  it.each([
    ['a network failure', { message: 'TypeError: fetch failed', code: '' }],
    ['an expired token', { message: 'JWT expired', code: 'PGRST303' }],
    ['an overloaded database', { message: 'too many connections', code: '53300' }],
  ])('does not refuse %s', (_name, cause) => {
    expect(refusalReason(stepError('m', 'log call', cause))).toBeNull()
  })

  it('does not refuse a plain error or a non-error', () => {
    expect(refusalReason(new TypeError('fetch failed'))).toBeNull()
    expect(refusalReason('boom')).toBeNull()
    expect(refusalReason(undefined)).toBeNull()
  })
})
