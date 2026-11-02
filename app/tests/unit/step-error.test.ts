import { describe, expect, it } from 'vitest'
import { stepError } from '@/lib/step-error'

describe('stepError', () => {
  it('names the module and the step, then the underlying message', () => {
    const error = stepError('ensureWorkspace', 'insert member', new Error('duplicate key'))

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('[ensureWorkspace] insert member failed: duplicate key')
  })

  it('keeps the original error as the cause', () => {
    const original = new Error('boom')
    expect(stepError('m', 's', original).cause).toBe(original)
  })

  it('reads message and code from error-shaped objects such as Supabase errors', () => {
    const supabaseError = { message: 'violates foreign key', code: '23503' }

    expect(stepError('m', 's', supabaseError).message).toBe(
      '[m] s failed: violates foreign key (code 23503)',
    )
  })

  it('copes with a thrown string or an unknown value', () => {
    expect(stepError('m', 's', 'nope').message).toBe('[m] s failed: nope')
    expect(stepError('m', 's', undefined).message).toBe('[m] s failed: unknown error')
  })
})
