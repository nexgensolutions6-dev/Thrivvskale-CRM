/**
 * Unit tests for probeSite: the redirect-following, time-limited "does this
 * website load" check. Uses a fake fetch and a fake resolver, so no network.
 */
import { describe, expect, it } from 'vitest'
import { probeSite, type ProbeFetch } from '@/lib/site-check/probeSite'
import { UnsafeUrlError } from '@/lib/site-check/urlSafety'

const PUBLIC_HOSTS: Record<string, string[]> = {
  'example.com': ['93.184.216.34'],
  'www.example.com': ['93.184.216.34'],
  'evil.example.net': ['93.184.216.35'],
  'internal.example.net': ['10.0.0.9'],
}
const resolve = async (host: string): Promise<string[]> => {
  const addresses = PUBLIC_HOSTS[host]
  if (!addresses) throw new Error(`ENOTFOUND ${host}`)
  return addresses
}

type Reply = { status: number; location?: string }
/** A fetch that answers from a table and records every URL it was asked for. */
function scriptedFetch(replies: Record<string, Reply>) {
  const asked: string[] = []
  let cancelled = 0
  const fetch: ProbeFetch = async (url) => {
    asked.push(url)
    const reply = replies[url]
    if (!reply) throw new TypeError(`fetch failed: no script for ${url}`)
    return {
      status: reply.status,
      headers: { get: (name) => (name.toLowerCase() === 'location' ? (reply.location ?? null) : null) },
      body: { cancel: async () => void cancelled++ },
    }
  }
  return { fetch, asked, cancelled: () => cancelled }
}

describe('probeSite', () => {
  it('reports a 200 as loading, without reading the body', async () => {
    const scripted = scriptedFetch({ 'https://example.com/': { status: 200 } })
    const result = await probeSite('https://example.com', { fetch: scripted.fetch, resolve })
    expect(result.loads).toBe(true)
    expect(scripted.cancelled()).toBe(1)
  })

  it('passes a manual-redirect request with a signal and a user agent', async () => {
    let seen: Parameters<ProbeFetch>[1] | undefined
    const fetch: ProbeFetch = async (_url, init) => {
      seen = init
      return { status: 200, headers: { get: () => null }, body: null }
    }
    await probeSite('https://example.com', { fetch, resolve })
    expect(seen?.redirect).toBe('manual')
    expect(seen?.method).toBe('GET')
    expect(seen?.signal).toBeInstanceOf(AbortSignal)
    expect(seen?.headers['User-Agent']).toMatch(/ThrivvSkale/)
  })

  it.each([500, 502, 503, 404, 403])('reports status %i as failed to load', async (status) => {
    const scripted = scriptedFetch({ 'https://example.com/': { status } })
    const result = await probeSite('https://example.com', { fetch: scripted.fetch, resolve })
    expect(result.loads).toBe(false)
    expect(result.detail).toContain(String(status))
  })

  it('follows a redirect to another public host', async () => {
    const scripted = scriptedFetch({
      'http://example.com/': { status: 301, location: 'https://www.example.com/home' },
      'https://www.example.com/home': { status: 200 },
    })
    const result = await probeSite('http://example.com', { fetch: scripted.fetch, resolve })
    expect(result.loads).toBe(true)
    expect(scripted.asked).toEqual(['http://example.com/', 'https://www.example.com/home'])
  })

  it('follows a relative Location header', async () => {
    const scripted = scriptedFetch({
      'https://example.com/': { status: 302, location: '/en/' },
      'https://example.com/en/': { status: 200 },
    })
    expect((await probeSite('https://example.com', { fetch: scripted.fetch, resolve })).loads).toBe(true)
  })

  it('allows exactly three redirects and fails on a fourth', async () => {
    const hop = (n: number) => `https://example.com/${n}`
    const three = scriptedFetch({
      'https://example.com/': { status: 302, location: hop(1) },
      [hop(1)]: { status: 302, location: hop(2) },
      [hop(2)]: { status: 302, location: hop(3) },
      [hop(3)]: { status: 200 },
    })
    expect((await probeSite('https://example.com', { fetch: three.fetch, resolve })).loads).toBe(true)

    const four = scriptedFetch({
      'https://example.com/': { status: 302, location: hop(1) },
      [hop(1)]: { status: 302, location: hop(2) },
      [hop(2)]: { status: 302, location: hop(3) },
      [hop(3)]: { status: 302, location: hop(4) },
      [hop(4)]: { status: 200 },
    })
    const result = await probeSite('https://example.com', { fetch: four.fetch, resolve })
    expect(result.loads).toBe(false)
    expect(result.detail).toMatch(/too many redirects/)
    expect(four.asked).not.toContain(hop(4))
  })

  it('refuses a redirect to a private address and never fetches it', async () => {
    const scripted = scriptedFetch({
      'https://example.com/': { status: 302, location: 'http://169.254.169.254/latest/meta-data/' },
      'http://169.254.169.254/latest/meta-data/': { status: 200 },
    })
    await expect(probeSite('https://example.com', { fetch: scripted.fetch, resolve })).rejects.toThrow(UnsafeUrlError)
    expect(scripted.asked).toEqual(['https://example.com/'])
  })

  it('refuses a redirect to a name that resolves to a private address', async () => {
    const scripted = scriptedFetch({
      'https://example.com/': { status: 302, location: 'http://internal.example.net/admin' },
    })
    await expect(probeSite('https://example.com', { fetch: scripted.fetch, resolve })).rejects.toThrow(/10\.0\.0\.9/)
  })

  it('refuses a redirect to a non-http scheme', async () => {
    const scripted = scriptedFetch({ 'https://example.com/': { status: 302, location: 'file:///etc/passwd' } })
    await expect(probeSite('https://example.com', { fetch: scripted.fetch, resolve })).rejects.toThrow(UnsafeUrlError)
  })

  it('refuses a private starting address without calling fetch', async () => {
    const scripted = scriptedFetch({})
    await expect(probeSite('http://localhost', { fetch: scripted.fetch, resolve })).rejects.toThrow(UnsafeUrlError)
    await expect(probeSite('http://169.254.169.254/', { fetch: scripted.fetch, resolve })).rejects.toThrow(UnsafeUrlError)
    expect(scripted.asked).toEqual([])
  })

  it('reports a redirect with no Location as failed', async () => {
    const scripted = scriptedFetch({ 'https://example.com/': { status: 302 } })
    const result = await probeSite('https://example.com', { fetch: scripted.fetch, resolve })
    expect(result.loads).toBe(false)
    expect(result.detail).toMatch(/Location/)
  })

  it('reports a network error as failed to load', async () => {
    const result = await probeSite('https://example.com', { fetch: scriptedFetch({}).fetch, resolve })
    expect(result.loads).toBe(false)
    expect(result.detail).toMatch(/request failed/)
  })

  it('reports a name that does not resolve as failed to load', async () => {
    const result = await probeSite('https://missing.example.org', { fetch: scriptedFetch({}).fetch, resolve })
    expect(result.loads).toBe(false)
    expect(result.detail).toMatch(/could not be resolved/)
  })

  it('aborts a request that hangs and reports it as failed to load', async () => {
    const hanging: ProbeFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    const started = Date.now()
    const result = await probeSite('https://example.com', { fetch: hanging, resolve, timeoutMs: 30 })
    expect(result.loads).toBe(false)
    expect(result.detail).toMatch(/timed out/)
    expect(Date.now() - started).toBeLessThan(2000)
  })
})
