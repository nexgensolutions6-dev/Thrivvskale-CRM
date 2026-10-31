/**
 * Checks the `next` parameter (where to go after signing in) so it can never
 * become an open redirect. Called by the login page and the auth callback
 * route.
 */
import { DEFAULT_HOME_PATH, isAuthPath, isLoginPath } from './path-rules'

const PLACEHOLDER_ORIGIN = 'http://placeholder.invalid'

/**
 * Returns `raw` when it is a same-origin relative path (with its query
 * string), otherwise the default home path. Refused: absolute URLs,
 * protocol-relative `//host`, backslashes, control characters, non-strings,
 * and the login and auth routes (signing in must not loop back to them).
 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_HOME_PATH
  if (!raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_HOME_PATH
  // Browsers treat a backslash like a slash, so "/\host" can mean "//host".
  if (raw.includes('\\') || hasControlCharacter(raw)) return DEFAULT_HOME_PATH

  const parsed = parseRelative(raw)
  if (parsed === null) return DEFAULT_HOME_PATH
  if (isLoginPath(parsed.pathname) || isAuthPath(parsed.pathname)) return DEFAULT_HOME_PATH

  const cleaned = `${parsed.pathname}${parsed.search}`
  // Dot segments can collapse into a protocol-relative path: "/.//host" becomes
  // "//host". Check the cleaned value again, not just the raw one.
  if (cleaned.startsWith('//')) return DEFAULT_HOME_PATH
  return cleaned
}

/** True for tab, CR, LF and the other control characters, which URL parsers silently drop. */
function hasControlCharacter(text: string): boolean {
  for (const character of text) {
    const code = character.charCodeAt(0)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/** Resolves `raw` against a made-up origin; null if it parses to another origin. */
function parseRelative(raw: string): URL | null {
  try {
    const url = new URL(raw, PLACEHOLDER_ORIGIN)
    return url.origin === PLACEHOLDER_ORIGIN ? url : null
  } catch {
    return null
  }
}
