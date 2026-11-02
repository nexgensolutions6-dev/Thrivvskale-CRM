/**
 * Turns a stored website address into a link that is safe to put in an
 * href: http or https only (a bare domain gets https://), else null. Stored
 * data is untrusted, so "javascript:" and the like never become links. Pure.
 * Called by LeadHeader.
 */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

export function siteHref(stored: string | null): string | null {
  const text = stored?.trim()
  if (!text) return null
  const candidate = HAS_SCHEME.test(text) && !/^[a-z0-9.-]+:\d+/i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
