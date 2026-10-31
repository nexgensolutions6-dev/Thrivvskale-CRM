/**
 * What an import would do, without doing it: the same counts as the report
 * (inserted means "would insert"). Called by the Import screen's preview action.
 */
import type { ImportDb } from '@/lib/import/importDb'
import { planImport } from '@/lib/import/importPlan'
import { buildReport, type ImportReport } from '@/lib/import/importReport'
import type { MappedLead } from '@/lib/import/mapLeadRow'

export async function previewImport(db: ImportDb, workspaceId: string, rows: MappedLead[]): Promise<ImportReport> {
  return buildReport(await planImport(db, workspaceId, rows))
}
