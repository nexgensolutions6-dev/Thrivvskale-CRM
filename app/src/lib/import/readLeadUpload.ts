/**
 * Turns the file chosen on the Import screen into rows ready to import:
 * checks it is a CSV of sensible size, parses it, maps every row. Called by
 * the Import screen's preview and import actions. Every refusal is an Error
 * whose message is written to be shown to the user as it is.
 */
import { mapLeadRow, type MappedLead } from '@/lib/import/mapLeadRow'
import { parseLeadsCsv } from '@/lib/import/parseLeadsCsv'

/** The real file is about 300 KB; this leaves room to grow and stays under the action's body limit. */
export const MAX_UPLOAD_BYTES = 1_500_000

export interface LeadUpload {
  fileName: string
  rawRows: Record<string, string>[]
  leads: MappedLead[]
}

export async function readLeadUpload(form: FormData): Promise<LeadUpload> {
  const file = form.get('file')
  if (!(file instanceof File)) throw new Error('Choose a CSV file to import.')
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error(`"${file.name}" is not a CSV file. Export your leads as .csv and try again.`)
  }
  if (file.size === 0) throw new Error(`"${file.name}" is empty.`)
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`"${file.name}" is too large (limit ${MAX_UPLOAD_BYTES / 1_000_000} MB).`)
  }

  const rawRows = parseLeadsCsv(await file.text())
  if (rawRows.length === 0) throw new Error(`"${file.name}" has no rows to import.`)
  return { fileName: file.name, rawRows, leads: rawRows.map(mapLeadRow) }
}
