/**
 * Writes the companies of an import plan: new ones are inserted, matched
 * ones are updated, each in a single batch request. Called by importLeads.
 * Inserts run first so a file row that joins a company new in the same file
 * finds it already there.
 */
import { toImportedFields, toNewCompanyRow } from '@/lib/import/companyRows'
import type { ImportDb } from '@/lib/import/importDb'
import type { ImportPlan } from '@/lib/import/importPlan'
import type { DefaultOffers } from '@/lib/import/verticalDefaults'
import { stepError } from '@/lib/step-error'

const MODULE = 'writeCompanies'

export async function writeCompanies(
  db: ImportDb,
  workspaceId: string,
  plan: ImportPlan,
  defaults: DefaultOffers,
): Promise<void> {
  await insertNewCompanies(db, workspaceId, plan, defaults)
  await updateMatchedCompanies(db, workspaceId, plan, defaults)
}

async function insertNewCompanies(db: ImportDb, workspaceId: string, plan: ImportPlan, defaults: DefaultOffers) {
  const rows = plan.entries
    .filter((entry) => entry.isNew)
    .map((entry) => toNewCompanyRow(entry, workspaceId, defaults))
  if (rows.length === 0) return

  const result = await db.from('companies').insert(rows)
  if (result.error) {
    throw stepError(MODULE, `insert ${rows.length} companies (first: "${rows[0].name}")`, result.error)
  }
}

async function updateMatchedCompanies(db: ImportDb, workspaceId: string, plan: ImportPlan, defaults: DefaultOffers) {
  // One row per company: a company matched by two file rows takes the later one.
  const byId = new Map(
    plan.entries
      .filter((entry) => !entry.isNew)
      .map((entry) => [entry.companyId, toImportedFields(entry, workspaceId, defaults)]),
  )
  const rows = [...byId.values()]
  if (rows.length === 0) return

  const result = await db.from('companies').upsert(rows, { onConflict: 'id' })
  if (result.error) {
    throw stepError(MODULE, `update ${rows.length} companies (first: "${rows[0].name}")`, result.error)
  }
}
