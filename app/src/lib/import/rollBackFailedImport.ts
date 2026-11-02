/**
 * Undoes the companies an import inserted when a later step of it fails, so a
 * retry cannot insert them a second time. Called by importLeads; always
 * throws. Phone numbers, openers and tasks go with a company (cascade); import_rows
 * only lose their link, so they are deleted first. Updated companies stay.
 */
import { inChunks } from '@/lib/import/chunks'
import type { ImportDb } from '@/lib/import/importDb'
import type { ImportPlan } from '@/lib/import/importPlan'
import { stepError } from '@/lib/step-error'

const MODULE = 'rollBackFailedImport'

export async function rollBackFailedImport(
  db: ImportDb,
  workspaceId: string,
  plan: ImportPlan,
  failure: unknown,
): Promise<never> {
  const insertedIds = plan.entries.filter((entry) => entry.isNew).map((entry) => entry.companyId)
  const reason = failure instanceof Error ? failure.message : String(failure)

  try {
    await deleteCompanies(db, workspaceId, insertedIds)
  } catch (rollbackError) {
    const step = `roll back ${insertedIds.length} new companies after "${reason}" (they may remain without their phone numbers)`
    throw stepError(MODULE, step, rollbackError)
  }
  throw stepError('importLeads', `import (rolled back: ${insertedIds.length} new companies removed)`, failure)
}

async function deleteCompanies(db: ImportDb, workspaceId: string, companyIds: string[]): Promise<void> {
  for (const chunk of inChunks(companyIds)) {
    const rows = await db.from('import_rows').delete().eq('workspace_id', workspaceId).in('company_id', chunk)
    if (rows.error) throw rows.error
    const companies = await db.from('companies').delete().eq('workspace_id', workspaceId).in('id', chunk)
    if (companies.error) throw companies.error
  }
}
