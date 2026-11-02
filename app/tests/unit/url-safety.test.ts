/**
 * Unit tests for the SSRF guard behind "re-check website": which addresses
 * are blocked (blockedAddress.ts) and which URLs may be fetched (urlSafety.ts).
 * No network: DNS is replaced by a fake resolver.
 */
import { describe, expect, it } from 'vitest'
import { isBlockedAddress } from '@/lib/site-check/blockedAddress'
import { assertPublicUrl, parseSiteUrl, UnresolvableHostError, UnsafeUrlError } from '@/lib/site-check/urlSafety'

/** A resolver that answers from a table, so tests never touch DNS. */
function fakeResolver(table: Record<string, string[]>) {
  return async (host: string): Promise<string[]> => {
    const addresses = table[host]
    if (!addresses) throw new Error(`ENOTFOUND ${host}`)
    return addresses
  }
}

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '127.255.255.254', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '169.254.0.1', '0.0.0.0', '0.1.2.3', '100.64.0.1',
    '192.0.0.8', '198.18.0.1', '224.0.0.1', '255.255.255.255',
  ])('blocks private or special IPv4 %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '1.1.1.1', '172.15.255.255', '172.32.0.1', '192.167.1.1', '169.253.1.1', '100.63.0.1', '203.0.113.7'])(
    'allows public IPv4 %s',
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false)
    },
  )

  it.each([
    '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'febf::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.1.2.3', '::ffff:169.254.169.254',
    '64:ff9b::7f00:1', '::127.0.0.1', 'fe80::1%eth0',
  ])('blocks private or special IPv6 %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8'])('allows public IPv6 %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false)
  })

  it('blocks text that is not an IP address (fail closed)', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true)
    expect(isBlockedAddress('')).toBe(true)
    expect(isBlockedAddress('1.2.3')).toBe(true)
  })
})

describe('parseSiteUrl', () => {
  it('accepts http and https', () => {
    expect(parseSiteUrl('https://example.com/a').hostname).toBe('example.com')
    expect(parseSiteUrl('http://example.com').protocol).toBe('http:')
  })

  it('assumes https for a bare domain, as the lead CSV stores them', () => {
    expect(parseSiteUrl('example.com').href).toBe('https://example.com/')
  })

  it.each(['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'gopher://example.com'])(
    'rejects the scheme in %s',
    (raw) => {
      expect(() => parseSiteUrl(raw)).toThrow(UnsafeUrlError)
    },
  )

  it('rejects credentials, odd ports and unparseable text', () => {
    expect(() => parseSiteUrl('http://user:pw@example.com')).toThrow(/credentials/)
    expect(() => parseSiteUrl('http://example.com:6379')).toThrow(/port/)
    expect(() => parseSiteUrl('http://')).toThrow(UnsafeUrlError)
    expect(() => parseSiteUrl('')).toThrow(UnsafeUrlError)
  })

  it('allows the default ports written out', () => {
    expect(() => parseSiteUrl('http://example.com:80')).not.toThrow()
    expect(() => parseSiteUrl('https://example.com:443')).not.toThrow()
  })
})

describe('assertPublicUrl', () => {
  const resolve = fakeResolver({
    'example.com': ['93.184.216.34'],
    'mixed.example.com': ['93.184.216.34', '10.0.0.5'],
    'internal.example.com': ['192.168.0.10'],
    'metadata.google.internal': ['169.254.169.254'],
    'v6.example.com': ['fd00::1'],
  })

  it('returns the URL when every resolved address is public', async () => {
    const url = await assertPublicUrl('https://example.com/path', resolve)
    expect(url.href).toBe('https://example.com/path')
  })

  it('blocks the cloud metadata address typed as an IP', async () => {
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/', resolve)).rejects.toThrow(UnsafeUrlError)
  })

  it('blocks localhost, its subdomains and loopback spellings', async () => {
    for (const raw of [
      'http://localhost', 'http://localhost:80/', 'http://app.localhost', 'http://LOCALHOST./',
      'http://127.0.0.1', 'http://127.1', 'http://2130706433', 'http://0x7f.0.0.1',
      'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://0.0.0.0',
    ]) {
      await expect(assertPublicUrl(raw, resolve), raw).rejects.toThrow(UnsafeUrlError)
    }
  })

  it('blocks private ranges typed as IPs', async () => {
    for (const raw of ['http://10.1.2.3', 'http://172.16.5.5', 'http://192.168.1.1', 'http://[fe80::1]', 'http://[fd00::1]']) {
      await expect(assertPublicUrl(raw, resolve), raw).rejects.toThrow(UnsafeUrlError)
    }
  })

  it('blocks a name that resolves to a private address', async () => {
    await expect(assertPublicUrl('http://internal.example.com', resolve)).rejects.toThrow(/192\.168\.0\.10/)
    await expect(assertPublicUrl('http://metadata.google.internal', resolve)).rejects.toThrow(UnsafeUrlError)
    await expect(assertPublicUrl('http://v6.example.com', resolve)).rejects.toThrow(UnsafeUrlError)
  })

  it('blocks a name when ANY of its addresses is private', async () => {
    await expect(assertPublicUrl('http://mixed.example.com', resolve)).rejects.toThrow(UnsafeUrlError)
  })

  it('reports a name that does not resolve as unresolvable, not unsafe', async () => {
    const error = await assertPublicUrl('http://nope.example.org', resolve).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(UnresolvableHostError)
    expect(error).not.toBeInstanceOf(UnsafeUrlError)
  })

  it('treats a resolver that returns no addresses as unresolvable', async () => {
    await expect(assertPublicUrl('http://empty.example.org', async () => [])).rejects.toThrow(UnresolvableHostError)
  })

  it('names the module and step in the message', async () => {
    await expect(assertPublicUrl('http://127.0.0.1', resolve)).rejects.toThrow(/\[urlSafety\] check host/)
  })
})
