/**
 * The WhatsApp Status column of the lead CSV, turned into the app's WaStatus.
 * Called by mapLeadRow. The CSV is authoritative: this text decides
 * waStatus, whatever the number itself looks like. An unknown value throws.
 */
import type { WaStatus } from '@/lib/domain'
import { stepError } from '@/lib/step-error'

const WA_STATUS_BY_CSV_TEXT = new Map<string, WaStatus>([
  ['Not verified', 'unconfirmed'],
  ['Verified', 'verified'],
  ['Landline', 'landline'],
  ['No number yet', 'none'],
])

export function parseWaStatus(text: string): WaStatus {
  const status = WA_STATUS_BY_CSV_TEXT.get(text)
  if (status === undefined) {
    const allowed = [...WA_STATUS_BY_CSV_TEXT.keys()].join(', ')
    throw stepError('waStatus', 'read WhatsApp Status', `"${text}" is not one of: ${allowed}`)
  }
  return status
}
