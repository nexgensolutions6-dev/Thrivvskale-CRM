/**
 * The SSRF guard for "re-check website": decides whether the server may fetch
 * a URL that came out of the database. Allows only http/https on the default
 * ports, no credentials, and only hosts whose every resolved address is public
 * (see blockedAddress). Called by probeSite for the first URL and every
 * redirect hop. A name that does not resolve is a different error from an
 * unsafe one, because an unreachable site is a normal "failed to load".
 */
import { isIP } from 'node:net'
import { isBlockedAddress } from './blockedAddress'

const MODULE = 'urlSafety'
const ALLOWED_PORTS = new Set(['', '80', '443']) // URL.port is '' for a scheme's default port
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/** Looks a host name up in DNS and returns every address it has. */
export type Resolver = (hostname: string) => Promise<string[]>

/** The URL must not be fetched: wrong scheme, private address, credentials, odd port. */
export class UnsafeUrlError extends Error {
  constructor(step: string, reason: string) {
    super(`[${MODULE}] ${step} failed: ${reason}`)
    this.name = 'UnsafeUrlError'
  }
}

/** The host name is not in DNS (or has no addresses). Not a security problem. */
export class UnresolvableHostError extends Error {
  constructor(hostname: string, reason: string) {
    super(`[${MODULE}] resolve host ${hostname} failed: ${reason}`)
    this.name = 'UnresolvableHostError'
  }
}

/** Parses the text and applies every rule that needs no DNS. A bare domain gets https://. */
export function parseSiteUrl(raw: string): URL {
  const text = raw.trim()
  let url: URL
  try {
    url = new URL(HAS_SCHEME.test(text) ? text : `https://${text}`)
  } catch {
    throw new UnsafeUrlError('check url', `${JSON.stringify(raw)} is not a web address`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('check scheme', `${url.protocol} is not allowed, only http and https (${url.href})`)
  }
  if (url.username !== '' || url.password !== '') {
    throw new UnsafeUrlError('check credentials', `a URL with credentials is not allowed (${url.hostname})`)
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UnsafeUrlError('check port', `port ${url.port} is not allowed, only 80 and 443 (${url.hostname})`)
  }
  return url
}

/** The host without IPv6 brackets or a trailing dot. */
function bareHost(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
}

/**
 * Returns the parsed URL when it is safe to fetch. Throws UnsafeUrlError for a
 * forbidden URL or host, UnresolvableHostError when DNS has no answer.
 */
export async function assertPublicUrl(raw: string, resolve: Resolver): Promise<URL> {
  const url = parseSiteUrl(raw)
  const host = bareHost(url)

  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new UnsafeUrlError('check host', `${host} is not allowed (loopback name)`)
  }

  const addresses = isIP(host) !== 0 ? [host] : await lookUp(host, resolve)
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new UnsafeUrlError(
        'check host',
        `${host} is not allowed, ${address} is a private, loopback or link-local address`,
      )
    }
  }
  return url
}

async function lookUp(host: string, resolve: Resolver): Promise<string[]> {
  let addresses: string[]
  try {
    addresses = await resolve(host)
  } catch (error) {
    throw new UnresolvableHostError(host, error instanceof Error ? error.message : String(error))
  }
  if (addresses.length === 0) throw new UnresolvableHostError(host, 'DNS returned no addresses')
  return addresses
}
