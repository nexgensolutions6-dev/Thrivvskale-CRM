/**
 * Reads the text of a lead CSV file into one object per row, keyed by the
 * header names. Called by the import runner (Task 6) and the import screen.
 * Excel exports start with a BOM and quote commas and line breaks; both are
 * handled here, so mapLeadRow only ever sees clean "Company Name" style keys.
 */
import Papa from 'papaparse'
import { stepError } from '@/lib/step-error'

const BYTE_ORDER_MARK = '﻿'

export function parseLeadsCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(stripBom(text), {
    header: true,
    skipEmptyLines: true,
  })

  // An unclosed quote swallows the rest of the file into one cell; refuse it.
  const brokenQuote = result.errors.find((error) => error.type === 'Quotes')
  if (brokenQuote) {
    const reason = `${brokenQuote.message}; check the quotes in the file`
    throw stepError('parseLeadsCsv', 'read CSV', reason)
  }

  return result.data
}

function stripBom(text: string): string {
  return text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text
}
