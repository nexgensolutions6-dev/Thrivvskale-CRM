/**
 * Gives every company that has no phone number a "find number" task, so it
 * shows up as work to do. Called by importLeads. A company that already has
 * that task (from an earlier import) does not get a second one.
 */
import { inChunks } from '@/lib/import/chunks'
import type { ImportDb } from '@/lib/import/importDb'
import type { ImportPlan } from '@/lib/import/importPlan'
import { stepError } from '@/lib/step-error'

const MODULE = 'findNumberTasks'
const TASK_TITLE = 'find number'

export async function createFindNumberTasks(db: ImportDb, workspaceId: string, plan: ImportPlan): Promise<void> {
  const needing = plan.entries.filter((entry) => entry.lead.needsNumber)
  const companyIds = [...new Set(needing.map((entry) => entry.companyId))]
  const alreadyHave = await companiesWithTask(db, workspaceId, companyIds)

  const rows = companyIds
    .filter((companyId) => !alreadyHave.has(companyId))
    .map((companyId) => ({
      workspace_id: workspaceId,
      company_id: companyId,
      title: TASK_TITLE,
      type: 'todo' as const,
    }))
  if (rows.length === 0) return

  const result = await db.from('tasks').insert(rows)
  if (result.error) throw stepError(MODULE, `insert ${rows.length} find-number tasks`, result.error)
}

async function companiesWithTask(db: ImportDb, workspaceId: string, companyIds: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (const chunk of inChunks(companyIds)) {
    const { data, error } = await db
      .from('tasks')
      .select('company_id')
      .eq('workspace_id', workspaceId)
      .eq('title', TASK_TITLE)
      .in('company_id', chunk)
    if (error) throw stepError(MODULE, 'read existing find-number tasks', error)
    for (const row of data) if (row.company_id) found.add(row.company_id)
  }
  return found
}
