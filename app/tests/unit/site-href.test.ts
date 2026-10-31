import { describe, expect, it } from 'vitest'
import { siteHref } from '@/lib/leads/siteHref'

describe('siteHref', () => {
  it('keeps http and https links', () => {
    expect(siteHref('https://divyankindustries.com')).toBe('https://divyankindustries.com/')
    expect(siteHref('http://example.com/a')).toBe('http://example.com/a')
  })
  it('adds https:// to a bare domain', () => {
    expect(siteHref('divyankindustries.com')).toBe('https://divyankindustries.com/')
    expect(siteHref('  www.example.com/x ')).toBe('https://www.example.com/x')
  })
  it('refuses other schemes and empty values', () => {
    expect(siteHref('javascript:alert(1)')).toBeNull()
    expect(siteHref('data:text/html,hi')).toBeNull()
    expect(siteHref('ftp://example.com')).toBeNull()
    expect(siteHref('   ')).toBeNull()
    expect(siteHref(null)).toBeNull()
  })
})
