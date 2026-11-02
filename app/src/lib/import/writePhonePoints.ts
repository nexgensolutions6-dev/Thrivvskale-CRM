/**
 * Stores the phone numbers of an import plan as contact_points, in one batch
 * request. Called by importLeads. A number the workspace already has (or one
 * that appeared earlier in the file) is not stored again.
 */
import type { ImportDb } from '@/lib/import/importDb'
import type { ImportPlan } from '@/lib/import/importPlan'
import { stepError } from '@/lib/step-error'

const MODULE = 'writePhonePoints'

export async function writePhonePoints(db: ImportDb, workspaceId: string, plan: ImportPlan): Promise<void> {
  const seen = new Set(plan.knownPhones)
  const rows = []
  for (const entry of plan.entries) {
    for (const point of entry.lead.points) {
      if (seen.has(point.e164)) continue
      seen.add(point.e164)
      rows.push({
        workspace_id: workspaceId,
        company_id: entry.companyId,
        e164: point.e164,
        kind: point.kind,
        wa_status: point.waStatus,
      })
    }
  }
  if (rows.length === 0) return

  const result = await db.from('contact_points').insert(rows)
  if (result.error) throw stepError(MODULE, `insert ${rows.length} phone numbers`, result.error)
}
