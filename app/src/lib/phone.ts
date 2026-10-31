export type PhoneKind = 'mobile' | 'landline'

export interface NormalizedPhone {
  e164: string
  kind: PhoneKind
}

// Characters that may legitimately appear in a hand-typed phone number.
// Anything else (letters, "/", ":", "@") means the cell is not a plain phone
// number (a URL, an "ext 5" note, two numbers in one cell) and is rejected
// rather than having its digits scraped out.
const PHONE_CHARS = /^[0-9+\s\-().]+$/

const NATIONAL_LENGTH = 10
const COUNTRY_CODE = '91'

/**
 * Normalises an Indian phone number to E.164 and classifies it.
 *
 * Accepted shapes: `+919866139900`, `919866139900`, `09866139900`,
 * `9866139900`, with any spaces, hyphens, dots or parentheses mixed in.
 * The national number must be 10 digits; a first digit of 6-9 is mobile and
 * 2-5 is landline (Hyderabad `40...`). Anything else returns `null`.
 */
export function normalizePhone(raw: string): NormalizedPhone | null {
  const text = raw.trim()
  if (text === '' || !PHONE_CHARS.test(text)) return null

  // A "+" is only valid once, and only before the first digit.
  const plusAt = text.indexOf('+')
  const hasPlus = plusAt !== -1
  if (hasPlus && (text.lastIndexOf('+') !== plusAt || /\d/.test(text.slice(0, plusAt)))) {
    return null
  }

  const digits = text.replace(/\D/g, '')

  // Decide the prefix by total length so a 10-digit national number that
  // happens to begin with "91" (a valid mobile) is never mangled.
  let national: string
  if (hasPlus) {
    // International format must be exactly +91 followed by 10 digits.
    if (digits.length !== COUNTRY_CODE.length + NATIONAL_LENGTH || !digits.startsWith(COUNTRY_CODE)) {
      return null
    }
    national = digits.slice(COUNTRY_CODE.length)
  } else if (digits.length === NATIONAL_LENGTH) {
    national = digits
  } else if (digits.length === NATIONAL_LENGTH + 1 && digits.startsWith('0')) {
    national = digits.slice(1)
  } else if (
    digits.length === NATIONAL_LENGTH + COUNTRY_CODE.length &&
    digits.startsWith(COUNTRY_CODE)
  ) {
    national = digits.slice(COUNTRY_CODE.length)
  } else {
    return null
  }

  const first = national[0]
  let kind: PhoneKind
  if (first >= '6' && first <= '9') kind = 'mobile'
  else if (first >= '2' && first <= '5') kind = 'landline'
  else return null

  return { e164: `+${COUNTRY_CODE}${national}`, kind }
}
