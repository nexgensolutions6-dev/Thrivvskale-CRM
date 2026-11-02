/**
 * Finds a WhatsApp (verified) cell that holds something other than a phone
 * number, such as a wa.me message link. Called by mapLeadRow so the import
 * report can count these cells (they are kept in the raw row, not in points).
 */
import { normalizePhone } from '@/lib/phone'

/** The raw cell text when it is filled in but not a phone number, else null. */
export function findUnparsedWhatsapp(whatsappCell: string): string | null {
  if (whatsappCell === '') return null
  return normalizePhone(whatsappCell) === null ? whatsappCell : null
}
