/**
 * The tel: link for a phone number, normalised to E.164 when it is an Indian
 * number. Pure. Used by the call card for the Call button and the QR code.
 */
import { normalizePhone } from '@/lib/phone'

export function telHref(phone: string): string {
  return `tel:${normalizePhone(phone)?.e164 ?? phone}`
}
