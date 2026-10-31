/**
 * Records an import for audit: one import_batches row for the file and one
 * import_rows row per CSV line holding the raw cells and the company it
 * became. Called by importLeads.
 */
import type { ImportDb } from '@/lib/import/importDb'
import type { ImportPlan } from '@/lib/import/importPlan'
import { stepError } from '@/lib/step-error'

const MODULE = 'writeImportRows'

export async function writeImportRows(
  db: ImportDb,
  workspaceId: string,
  plan: ImportPlan,
  rawRows: Record<string, string>[],
  fileName: string,
): Promise<void> {
  const batch = await db
    .from('import_batches')
    .insert({ workspace_id: workspaceId, file_name: fileName, row_count: rawRows.length })
    .select('id')
    .single()
  if (batch.error) throw stepError(MODULE, `create the import batch for ${fileName}`, batch.error)

  const rows = plan.entries.map((entry, position) => ({
    workspace_id: workspaceId,
    batch_id: batch.data.id,
    row_number: position + 1,
    raw: rawRows[position],
    status: 'imported' as const,
    company_id: entry.companyId,
  }))
  if (rows.length === 0) return

  const result = await db.from('import_rows').insert(rows)
  if (result.error) throw stepError(MODULE, `insert ${rows.length} import rows`, result.error)
}
