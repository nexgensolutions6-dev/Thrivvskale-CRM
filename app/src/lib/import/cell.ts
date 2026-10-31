/**
 * Reads one text cell of a parsed lead CSV row. Used by mapLeadRow and the
 * other import helpers. A column missing from the row (short line, different
 * export) reads as '' so no helper ever sees undefined.
 */
import { stepError } from '@/lib/step-error'

export type CsvRow = Record<string, string>

/** The trimmed cell text, '' when the cell or the whole column is absent. */
export function readText(row: CsvRow, column: string): string {
  return (row[column] ?? '').trim()
}

/** Like readText, but an empty cell is null so "no value" is stored one way. */
export function readTextOrNull(row: CsvRow, column: string): string | null {
  const text = readText(row, column)
  return text === '' ? null : text
}

/** For columns a lead cannot do without (the company name). */
export function readRequiredText(row: CsvRow, column: string): string {
  const text = readText(row, column)
  if (text === '') throw stepError('cell', `read ${column}`, 'the cell is empty')
  return text
}
