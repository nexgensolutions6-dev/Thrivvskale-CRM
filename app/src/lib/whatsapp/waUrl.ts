/**
 * Pure URL pieces for WhatsApp click-to-chat (https://wa.me/<digits>).
 * Used only by link.ts; no database, no framework code.
 */
const WA_BASE = 'https://wa.me/'

/** `+919876543210` becomes `919876543210`: wa.me wants digits only. */
export function digitsOf(e164: string): string {
  return e164.replace(/\D/g, '')
}

export function plainWaUrl(e164: string): string {
  return `${WA_BASE}${digitsOf(e164)}`
}

export function waUrlWithText(e164: string, text: string): string {
  return `${plainWaUrl(e164)}?text=${encodeURIComponent(text)}`
}
