/**
 * Number columns of the lead CSV: Google Rating, Google Reviews, Lead Score.
 * Called by mapLeadRow. Text that is not a plain number throws, naming the
 * column, so a bad cell is never silently turned into 0.
 */
import { readText, type CsvRow } from '@/lib/import/cell'
import { stepError } from '@/lib/step-error'

const MODULE = 'parseNumber'
const PLAIN_NUMBER = /^\d+(\.\d+)?$/

/** A number column that must be filled in (Lead Score). */
export function readNumber(row: CsvRow, column: string): number {
  return toNumber(column, readText(row, column))
}

/** A number column that may be blank (Google Rating, Google Reviews): blank is null. */
export function readOptionalNumber(row: CsvRow, column: string): number | null {
  const text = readText(row, column)
  return text === '' ? null : toNumber(column, text)
}

function toNumber(column: string, text: string): number {
  if (!PLAIN_NUMBER.test(text)) {
    throw stepError(MODULE, `read ${column}`, `"${text}" is not a number`)
  }
  return Number(text)
}
