/**
 * The Priority column of the lead CSV (A, B or C). Called by mapLeadRow.
 * Anything else throws, naming the column and the value.
 */
import type { Priority } from '@/lib/domain'
import { stepError } from '@/lib/step-error'

export function parsePriority(text: string): Priority {
  if (text === 'A' || text === 'B' || text === 'C') return text
  throw stepError('leadPriority', 'read Priority', `"${text}" is not A, B or C`)
}
