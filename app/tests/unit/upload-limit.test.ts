import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, oversizeMessage } from '@/lib/import/uploadLimit'

describe('oversizeMessage', () => {
  it('accepts a file at the limit', () => {
    expect(oversizeMessage({ name: 'leads.csv', size: MAX_UPLOAD_BYTES })).toBeNull()
  })

  it('names a file over the limit and states the limit', () => {
    const message = oversizeMessage({ name: 'big.csv', size: MAX_UPLOAD_BYTES + 1 })

    expect(message).toBe('"big.csv" is too large (limit 1.5 MB).')
  })
})
