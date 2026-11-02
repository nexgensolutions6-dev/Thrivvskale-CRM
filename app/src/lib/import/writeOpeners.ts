/**
 * Stores each imported company's CSV "Call Opener" as a content_variants row
 * (kind opener, company_id set, default mix and script). Safe to run twice: a
 * company keeps one import opener, and a changed CSV opener updates it. A blank
 * opener writes nothing. Called by importLeads, after the companies exist; a
 * new company's openers vanish with it if the import rolls back (cascade).
 */
import { collectCompanyOpeners, type CompanyOpener } from '@/lib/import/companyOpeners'
import { inChunks } from '@/lib/import/chunks'
import type { ImportDb } from '@/lib/import/importDb'
import type { ImportPlan } from '@/lib/import/importPlan'
import { stepError } from '@/lib/step-error'

const MODULE = 'writeOpeners'

export async function writeOpeners(db: ImportDb, workspaceId: string, plan: ImportPlan): Promise<void> {
  const openers = collectCompanyOpeners(plan)
  if (openers.length === 0) return

  const existing = await findStoredOpeners(db, workspaceId, openers)
  const fresh: CompanyOpener[] = []
  for (const opener of openers) {
    const stored = existing.get(opener.companyId)
    if (!stored) fresh.push(opener)
    else if (stored.body !== opener.body) await updateOpener(db, workspaceId, stored.id, opener)
  }
  if (fresh.length === 0) return

  const rows = fresh.map((opener) => ({
    workspace_id: workspaceId,
    company_id: opener.companyId,
    kind: 'opener' as const,
    body: opener.body,
  }))
  const result = await db.from('content_variants').insert(rows)
  if (result.error) {
    throw stepError(MODULE, `insert ${rows.length} openers (first: "${fresh[0].companyName}")`, result.error)
  }
}

/** company id -> its oldest stored opener (the one an earlier import wrote). */
async function findStoredOpeners(db: ImportDb, workspaceId: string, openers: CompanyOpener[]) {
  const stored = new Map<string, { id: string; body: string }>()
  for (const chunk of inChunks(openers)) {
    const result = await db
      .from('content_variants')
      .select('id, company_id, body')
      .eq('workspace_id', workspaceId)
      .eq('kind', 'opener')
      .in('company_id', chunk.map((opener) => opener.companyId))
      .order('created_at')
    if (result.error) {
      throw stepError(MODULE, `read stored openers (first: "${chunk[0].companyName}")`, result.error)
    }
    for (const row of result.data) {
      if (row.company_id && !stored.has(row.company_id)) stored.set(row.company_id, { id: row.id, body: row.body })
    }
  }
  return stored
}

async function updateOpener(db: ImportDb, workspaceId: string, id: string, opener: CompanyOpener) {
  const result = await db
    .from('content_variants')
    .update({ body: opener.body, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
  if (result.error) throw stepError(MODULE, `update the opener of "${opener.companyName}"`, result.error)
}
