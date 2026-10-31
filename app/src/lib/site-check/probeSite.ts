/**
 * Asks a website whether it loads: one GET (body never read), redirects
 * followed by hand up to 3 hops, every hop checked by urlSafety BEFORE it is
 * fetched, 8 second overall time limit. Returns loads/failed with a short
 * detail; throws UnsafeUrlError when any hop points somewhere forbidden.
 * Called by recheckSiteForCompany. Fetch and DNS are injectable for tests.
 *
 * Known limit: the name is resolved here and again inside fetch, so a DNS
 * answer that changes between the two could slip past the check.
 */
import { dnsResolver } from './dnsResolver'
import { assertPublicUrl, UnresolvableHostError, type Resolver } from './urlSafety'

const MODULE = 'probeSite'
const DEFAULT_TIMEOUT_MS = 8000
const MAX_REDIRECTS = 3
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const USER_AGENT = 'Mozilla/5.0 (compatible; ThrivvSkaleCRM-site-check/1.0)'

export interface ProbeRequestInit {
  method: 'GET'
  redirect: 'manual'
  signal: AbortSignal
  headers: Record<string, string>
}

/** The part of a fetch Response that probeSite uses. */
export interface ProbeResponse {
  status: number
  headers: { get(name: string): string | null }
  body?: { cancel(): Promise<unknown> } | null
}

export type ProbeFetch = (url: string, init: ProbeRequestInit) => Promise<ProbeResponse>

export interface ProbeDeps {
  fetch?: ProbeFetch
  resolve?: Resolver
  timeoutMs?: number
}

export interface ProbeResult {
  loads: boolean
  /** Short human text for the activity log, e.g. "HTTP 503" or "timed out after 8000 ms". */
  detail: string
}

const loaded = (detail: string): ProbeResult => ({ loads: true, detail })
const failed = (detail: string): ProbeResult => ({ loads: false, detail })

export async function probeSite(rawUrl: string, deps: ProbeDeps = {}): Promise<ProbeResult> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await followRedirects(rawUrl, controller.signal, timeoutMs, deps)
  } finally {
    clearTimeout(timer)
  }
}

async function followRedirects(
  startUrl: string,
  signal: AbortSignal,
  timeoutMs: number,
  deps: ProbeDeps,
): Promise<ProbeResult> {
  const doFetch: ProbeFetch = deps.fetch ?? fetch
  const resolve = deps.resolve ?? dnsResolver
  const timedOut = () => failed(`timed out after ${timeoutMs} ms`)
  const deadline = rejectWhenAborted(signal)

  let current = startUrl
  for (let redirectsFollowed = 0; ; redirectsFollowed++) {
    let url: URL
    try {
      url = await Promise.race([assertPublicUrl(current, resolve), deadline])
    } catch (error) {
      if (signal.aborted) return timedOut()
      if (error instanceof UnresolvableHostError) return failed(`host could not be resolved: ${error.message}`)
      throw error // UnsafeUrlError: the caller must see it
    }

    let response: ProbeResponse
    try {
      response = await Promise.race([doFetch(url.href, requestInit(signal)), deadline])
    } catch (error) {
      return signal.aborted ? timedOut() : failed(`request failed: ${describe(error)}`)
    }
    await discardBody(response)

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response.status < 400 ? loaded(`HTTP ${response.status}`) : failed(`HTTP ${response.status}`)
    }
    const location = response.headers.get('location')
    if (!location) return failed(`HTTP ${response.status} redirect without a Location header`)
    if (redirectsFollowed >= MAX_REDIRECTS) return failed(`too many redirects (more than ${MAX_REDIRECTS})`)
    try {
      current = new URL(location, url).href
    } catch {
      return failed(`redirect Location is not a valid URL: ${JSON.stringify(location)}`)
    }
  }
}

function requestInit(signal: AbortSignal): ProbeRequestInit {
  return { method: 'GET', redirect: 'manual', signal, headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' } }
}

/** A promise that rejects when the time limit fires, so slow DNS cannot outlast it. */
function rejectWhenAborted(signal: AbortSignal): Promise<never> {
  const deadline = new Promise<never>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error(`${MODULE}: time limit reached`)), { once: true })
  })
  deadline.catch(() => undefined) // raced below; this stops an unhandled-rejection warning when nothing is racing
  return deadline
}

/** Stops the download: only the status line and headers matter. */
async function discardBody(response: ProbeResponse): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // The response is already decided; a failing cancel changes nothing.
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
