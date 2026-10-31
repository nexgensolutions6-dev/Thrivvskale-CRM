/**
 * Builds a lead's contact points from the Phone and WhatsApp (verified)
 * columns plus the CSV's WhatsApp Status. Called by mapLeadRow.
 *
 * The CSV status describes the WhatsApp number: the WhatsApp column when it
 * holds a number, otherwise the Phone. A phone that is not the WhatsApp
 * number stays 'unconfirmed'. A WhatsApp cell that is not a number (a wa.me
 * link) is ignored here; findUnparsedWhatsapp reports it.
 */
import type { WaStatus } from '@/lib/domain'
import { normalizePhone, type NormalizedPhone } from '@/lib/phone'
import { stepError } from '@/lib/step-error'

export interface LeadPoint {
  e164: string
  kind: 'business' | 'landline'
  waStatus: WaStatus
}

const MODULE = 'phonePoints'

export function buildPhonePoints(
  phoneCell: string,
  whatsappCell: string,
  status: WaStatus,
): LeadPoint[] {
  const phone = readPhone(phoneCell)
  const whatsapp = normalizePhone(whatsappCell)
  const statusNumber = whatsapp ?? phone

  const points: LeadPoint[] = []
  if (phone) points.push(toPoint(phone, statusNumber, status))

  const whatsappIsSeparateNumber = whatsapp !== null && whatsapp.e164 !== phone?.e164
  if (whatsappIsSeparateNumber) points.push(toPoint(whatsapp, statusNumber, status))
  return points
}

/** Blank is "no number" (null); text that is not a phone number is an error. */
function readPhone(cell: string): NormalizedPhone | null {
  if (cell === '') return null
  const phone = normalizePhone(cell)
  if (phone === null) {
    throw stepError(MODULE, 'read Phone', `"${cell}" is not an Indian phone number`)
  }
  return phone
}

/** Only the number the CSV status is about gets that status; the other is unconfirmed. */
function toPoint(
  phone: NormalizedPhone,
  statusNumber: NormalizedPhone | null,
  status: WaStatus,
): LeadPoint {
  const waStatus = phone.e164 === statusNumber?.e164 ? status : 'unconfirmed'
  return { e164: phone.e164, kind: waStatus === 'landline' ? 'landline' : 'business', waStatus }
}
