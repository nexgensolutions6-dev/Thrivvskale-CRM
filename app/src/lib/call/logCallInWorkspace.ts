/**
 * `logCallInWorkspace`: validates a call, finds the contact it counts for, works
 * out their next language mix, then calls the log_call database function, which
 * does all writing in one transaction and is idempotent on clientId. Uses the
 * user's client, so RLS applies. Called by the logCall server action and DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/db/types'
import type { Mix } from '@/lib/domain'
import { contactMix } from '@/lib/leads/contactMix'
import { pickPrimaryContact } from '@/lib/leads/primaryContact'
import { readContacts, type LeadScope } from '@/lib/leads/readLeadParts'
import { requireCompany } from '@/lib/leads/requireCompany'
import { stepError } from '@/lib/step-error'
import type { LogCallResult } from './logCallInput'
import { nextContactMix } from './nextContactMix'
import { validateLogCallInput } from './validateLogCallInput'

const MODULE = 'logCallInWorkspace'

type Db = SupabaseClient<Database>
type CallContact = { id: string; mix: Mix }

export async function logCallInWorkspace(db: Db, workspaceId: string, raw: unknown): Promise<LogCallResult> {
  const input = validateLogCallInput(raw)
  const company = await requireCompany(db, MODULE, workspaceId, input.companyId)
  const scope: LeadScope = { db, workspaceId, companyId: company.id, companyName: company.name }

  const contact = await findCallContact(scope, input.contactPointId)
  const nextMix = contact
    ? await nextContactMix(db, {
        workspaceId,
        contactId: contact.id,
        currentMix: contact.mix,
        outcome: input.outcome,
        mixUsed: input.mixUsed,
      })
    : null

  const result = await db.rpc('log_call', {
    p_workspace_id: workspaceId,
    p_client_id: input.clientId,
    p_company_id: input.companyId,
    p_contact_point_id: input.contactPointId,
    p_contact_id: contact?.id,
    p_outcome: input.outcome,
    p_duration_seconds: input.durationSeconds ?? undefined,
    p_duration_is_estimate: input.durationIsEstimate,
    p_mix_used: input.mixUsed,
    p_objection_ids: input.objectionIds,
    p_lost_reason: input.lostReason,
    p_opener_id: input.openerId,
    p_occurred_at: occurredAtNotInFuture(input.occurredAt),
    p_next_mix_profile: nextMix ?? undefined,
    p_pain_point: input.painPoint as Json | undefined,
    p_next_action: input.nextAction as Json | undefined,
  }).single()
  if (result.error) throw stepError(MODULE, `log call on "${company.name}"`, result.error)
  return { callId: result.data.call_id, duplicate: result.data.duplicate }
}

/** The number's own contact; a company line counts for the lead's primary contact. */
async function findCallContact(scope: LeadScope, contactPointId: string): Promise<CallContact | null> {
  const point = await scope.db
    .from('contact_points')
    .select('contact_id')
    .eq('workspace_id', scope.workspaceId)
    .eq('company_id', scope.companyId)
    .eq('id', contactPointId)
    .maybeSingle()
  if (point.error) throw stepError(MODULE, `read contact point of "${scope.companyName}"`, point.error)
  if (!point.data) {
    throw stepError(MODULE, `read contact point of "${scope.companyName}"`, `${contactPointId} is not its number`)
  }

  const contacts = await readContacts(scope)
  const ownerId = point.data.contact_id
  const contact = contacts.find((row) => row.id === ownerId) ?? pickPrimaryContact(contacts)
  return contact ? { id: contact.id, mix: contactMix(contact) ?? [] } : null
}

/** A phone with a fast clock must not log a call in the future. */
function occurredAtNotInFuture(occurredAt: string | undefined): string | undefined {
  if (occurredAt === undefined) return undefined
  return new Date(Math.min(Date.parse(occurredAt), Date.now())).toISOString()
}
