/**
 * Decides, for every lead in a file, which company it is: an existing one
 * (update) or a new one (insert). Called by importLeads and previewImport,
 * so the preview shows exactly what the import will do. Reads the database,
 * writes nothing.
 * A lead that matches an earlier lead of the same file (same phone or own
 * domain) joins that company and counts as an update, not a second company.
 */
import { randomUUID } from 'node:crypto'
import { addToIndex, findCompanyId } from '@/lib/import/companyIndex'
import type { ImportDb } from '@/lib/import/importDb'
import { loadCompanyIndex } from '@/lib/import/loadCompanyIndex'
import type { MappedLead } from '@/lib/import/mapLeadRow'

export interface PlannedLead {
  lead: MappedLead
  companyId: string
  isNew: boolean
}

export interface ImportPlan {
  entries: PlannedLead[]
  /** Phone numbers the workspace already has, so they are not stored twice. */
  knownPhones: Set<string>
}

export async function planImport(
  db: ImportDb,
  workspaceId: string,
  leads: MappedLead[],
): Promise<ImportPlan> {
  const index = await loadCompanyIndex(db, workspaceId, leads)
  const knownPhones = new Set(index.byPhone.keys())

  const entries = leads.map((lead): PlannedLead => {
    const existingId = findCompanyId(index, lead)
    const companyId = existingId ?? randomUUID()
    addToIndex(index, lead, companyId)
    return { lead, companyId, isNew: existingId === null }
  })

  return { entries, knownPhones }
}
