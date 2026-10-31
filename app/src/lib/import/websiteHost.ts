/**
 * The host name of a Website cell ("example.com"). Used by platformDomains and
 * websiteValidity, and by Task 6 to match a lead to an existing company.
 * The CSV has values without a scheme ("justdial.com/Ahmedabad/...") and
 * values that are not addresses at all ("sameep.app listing").
 */

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/** Host without a leading "www.", or null when the text is not a web address. */
export function hostOfUrl(text: string): string | null {
  const trimmed = text.trim()
  const address = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`

  let host: string
  try {
    host = new URL(address).hostname
  } catch {
    return null
  }

  const withoutWww = host.replace(/^www\./, '')
  // A real website host has a dot; "tbd" or "n/a" typed into the cell does not.
  return withoutWww.includes('.') ? withoutWww : null
}
