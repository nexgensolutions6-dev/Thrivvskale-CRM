/**
 * The lead import: puts the mapped rows of a CSV into the workspace, safe to
 * run twice on the same file. Called by the Import screen's confirm action.
 * It runs as the signed-in user's client, so row-level security keeps every
 * write inside their workspace.
 *
 * A failure part-way leaves what was written so far; running the import again
 * finishes the job, because stored companies match instead of doubling.
 */
import { createFindNumberTasks } from '@/lib/import/findNumberTasks'
import type { ImportDb } from '@/lib/import/importDb'
import { planImport } from '@/lib/import/importPlan'
import { buildReport, type ImportReport } from '@/lib/import/importReport'
import type { MappedLead } from '@/lib/import/mapLeadRow'
import { saveVerticalDefaults } from '@/lib/import/verticalDefaults'
import { writeCompanies } from '@/lib/import/writeCompanies'
import { writeImportRows } from '@/lib/import/writeImportRows'
import { writePhonePoints } from '@/lib/import/writePhonePoints'
import { stepError } from '@/lib/step-error'

export type { ImportReport }

export async function importLeads(
  db: ImportDb,
  workspaceId: string,
  rows: MappedLead[],
  rawRows: Record<string, string>[],
  fileName = 'leads.csv',
): Promise<ImportReport> {
  if (rows.length !== rawRows.length) {
    const reason = `${rows.length} mapped rows but ${rawRows.length} raw rows`
    throw stepError('importLeads', 'check the rows', reason)
  }

  const defaults = await saveVerticalDefaults(db, workspaceId, rows)
  const plan = await planImport(db, workspaceId, rows)
  await writeCompanies(db, workspaceId, plan, defaults)
  await writePhonePoints(db, workspaceId, plan)
  await createFindNumberTasks(db, workspaceId, plan)
  await writeImportRows(db, workspaceId, plan, rawRows, fileName)
  return buildReport(plan)
}
