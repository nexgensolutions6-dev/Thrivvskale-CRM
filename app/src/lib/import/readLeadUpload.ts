/**
 * Turns the file chosen on the Import screen into rows ready to import:
 * checks it is a CSV of sensible size, parses it, maps every row. Called by
 * the Import screen's preview and import actions. Every refusal is an Error
 * whose message is written to be shown to the user as it is.
 */
import { mapLeadRow, type MappedLead } from '@/lib/import/mapLeadRow'
import { parseLeadsCsv } from '@/lib/import/parseLeadsCsv'
import { MAX_UPLOAD_BYTES, oversizeMessage } from '@/lib/import/uploadLimit'

export { MAX_UPLOAD_BYTES }

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
  const tooLarge = oversizeMessage(file)
  if (tooLarge) throw new Error(tooLarge)

  const rawRows = parseLeadsCsv(await file.text())
  if (rawRows.length === 0) throw new Error(`"${file.name}" has no rows to import.`)
  return { fileName: file.name, rawRows, leads: rawRows.map(mapLeadRow) }
}
