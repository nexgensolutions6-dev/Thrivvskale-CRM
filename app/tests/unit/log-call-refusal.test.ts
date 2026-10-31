/**
 * Unit tests for refusalReason: a permanent "no" from the rules or the database
 * becomes a dead letter, while anything that may heal by itself stays a transport
 * failure that keeps retrying. Guessing wrong here loses or blocks real calls.
 */
import { describe, expect, it, vi } from 'vitest'
import { refusalReason } from '@/lib/call/logCallRefusal'
import { validateLogCallInput } from '@/lib/call/validateLogCallInput'
import { stepError } from '@/lib/step-error'

const UUID = '3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b'

describe('refusalReason', () => {
  it('refuses a validation failure', () => {
    let failure: unknown
    try {
      validateLogCallInput({})
    } catch (error) {
      failure = error
    }
    expect(refusalReason(failure)).toBe('The outcome of this call was not valid.')
  })

  it('refuses a rule failure with a fixed sentence', () => {
    const error = stepError('logCallInWorkspace', 'read contact point of "Acme"', `${UUID} is not its number`)
    expect(refusalReason(error)).toBe("That number is not one of this lead's numbers.")
  })

  it('refuses a log_call exception', () => {
    const cause = { code: 'P0001', message: `[log_call] check opener failed: ${UUID} is not an opener usable on "Acme"` }
    expect(refusalReason(stepError('logCallInWorkspace', 'log call on "Acme"', cause))).toBe(
      'That opener cannot be used on this lead.',
    )
  })

  it('never lets an id, a bracket or a code reach the reason', () => {
    const messages = [
      `[log_call] find company ${UUID} failed: not found in workspace ${UUID}`,
      `[log_call] check membership failed: not a member of workspace ${UUID}`,
      `[log_call] find earlier call failed: client id ${UUID} is used by something else on "Acme"`,
      `[log_call] check contact failed: ${UUID} is not a contact of "Acme"`,
      `[log_call] check objections failed: an objection of the call on "Acme" is not in this workspace`,
      `[log_call] something new failed: ${UUID}`,
    ]
    for (const message of messages) {
      const cause = { code: 'P0001', message }
      const reason = refusalReason(stepError('logCallInWorkspace', `log call on "Acme"`, cause))
      expect(reason).not.toBeNull()
      expect(reason).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}|\[|code |Acme/)
    }
  })

  it('falls back to a generic sentence for an unknown refusal, and logs the full text', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cause = { code: '23514', message: `bad row ${UUID}` }
    expect(refusalReason(stepError('m', 'log call', cause))).toBe('The server refused this call.')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[logCallRefusal]'), expect.stringContaining(UUID))
    log.mockRestore()
  })

  it('names a failed field but never the bad value', () => {
    const error = stepError('validateLogCallInput', 'validate clientId', `must be a uuid, got "${UUID}"`)
    expect(refusalReason(error)).toBe('The clientId of this call was not valid.')
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
