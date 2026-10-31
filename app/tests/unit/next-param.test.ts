import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/lib/auth/next-param'

describe('safeNextPath', () => {
  it('falls back to the default landing page when nothing is given', () => {
    expect(safeNextPath(undefined)).toBe('/today')
    expect(safeNextPath(null)).toBe('/today')
    expect(safeNextPath('')).toBe('/today')
  })

  it('keeps a same-origin relative path, including its query string', () => {
    expect(safeNextPath('/leads')).toBe('/leads')
    expect(safeNextPath('/leads/42?tab=calls&x=1')).toBe('/leads/42?tab=calls&x=1')
    expect(safeNextPath('/today')).toBe('/today')
  })

  it.each([
    'https://evil.example',
    'http://evil.example/leads',
    '//evil.example',
    '//evil.example/leads',
    '/\\evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    'javascript:alert(1)',
    'leads',
    '   /leads',
    '/leads\r\nSet-Cookie: a=b',
    // Dot segments collapse to "//evil.example" once the URL is normalised.
    '/.//evil.example',
    '/..//evil.example',
    '/a/..//evil.example',
    '/%2e%2e//evil.example',
  ])('rejects the unsafe value %j', (value) => {
    expect(safeNextPath(value)).toBe('/today')
  })

  it('never sends a signed-in user back to the login or callback routes', () => {
    expect(safeNextPath('/login')).toBe('/today')
    expect(safeNextPath('/login?next=/leads')).toBe('/today')
    expect(safeNextPath('/auth/callback?code=abc')).toBe('/today')
  })

  it('ignores values that are not a single string', () => {
    expect(safeNextPath(['/leads', '/today'] as unknown as string)).toBe('/today')
    expect(safeNextPath(42 as unknown as string)).toBe('/today')
  })
})
