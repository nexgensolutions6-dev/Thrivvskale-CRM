/**
 * One small reader per part of a lead (contacts, phone numbers, openers,
 * tasks, timeline, call outcomes, workspace mix, vertical default). Each runs
 * one query with the caller's client, so row-level security applies, and
 * throws "[readLeadParts] read <part> of "<company>" failed: ...". Called by
 * loadLead.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import type { LangCode, Mix, Outcome } from '@/lib/domain'
import { stepError } from '@/lib/step-error'
import { parseMixText } from './contactMix'
import type { LeadActivity, LeadContact, LeadOpener, LeadPoint, LeadTask } from './leadView'

const MODULE = 'readLeadParts'
const TIMELINE_LIMIT = 100
const OPENER_LIMIT = 200
const OPENER_COLUMNS = 'id, body, mix, script, register, vertical, company_id'
const DEFAULT_WORKSPACE_MIX: Mix = ['te', 'hi', 'en']

type Db = SupabaseClient<Database>

/** What every reader needs to find one company's rows and to name it in errors. */
export interface LeadScope {
  db: Db
  workspaceId: string
  companyId: string
  companyName: string
}

function fail(scope: LeadScope, part: string, cause: unknown): Error {
  return stepError(MODULE, `read ${part} of "${scope.companyName}"`, cause)
}

export async function readContacts(scope: LeadScope): Promise<LeadContact[]> {
  const result = await scope.db
    .from('contacts')
    .select('*')
    .eq('workspace_id', scope.workspaceId)
    .eq('company_id', scope.companyId)
    .order('created_at')
  if (result.error) throw fail(scope, 'contacts', result.error)
  return result.data.map((row) => ({
    id: row.id,
    name: row.name,
    nameLatin: row.name_latin,
    role: row.role,
    languages: row.languages,
    mixProfile: row.mix_profile,
    scriptPref: row.script_pref,
    register: row.register,
    notes: row.notes,
    createdAt: row.created_at,
  }))
}

export async function readPoints(scope: LeadScope): Promise<LeadPoint[]> {
  const result = await scope.db
    .from('contact_points')
    .select('id, contact_id, e164, kind, wa_status')
    .eq('workspace_id', scope.workspaceId)
    .eq('company_id', scope.companyId)
    .order('created_at')
  if (result.error) throw fail(scope, 'phone numbers', result.error)
  return result.data.map((row) => ({
    id: row.id,
    contactId: row.contact_id,
    e164: row.e164,
    kind: row.kind,
    waStatus: row.wa_status,
  }))
}

/**
 * This company's own openers (the one from its CSV row), then the generic ones
 * (no company) written for its vertical or for any vertical. Another company's
 * opener is never returned. The company's own query has no row limit that could
 * cut it off; only the generic list is capped.
 */
export async function readOpeners(scope: LeadScope, vertical: string | null): Promise<LeadOpener[]> {
  const own = await scope.db
    .from('content_variants')
    .select(OPENER_COLUMNS)
    .eq('workspace_id', scope.workspaceId)
    .eq('kind', 'opener')
    .eq('company_id', scope.companyId)
    .order('created_at')
  if (own.error) throw fail(scope, 'company openers', own.error)
  const generic = await scope.db
    .from('content_variants')
    .select(OPENER_COLUMNS)
    .eq('workspace_id', scope.workspaceId)
    .eq('kind', 'opener')
    .is('company_id', null)
    .order('created_at')
    .limit(OPENER_LIMIT)
  if (generic.error) throw fail(scope, 'openers', generic.error)
  const fitting = generic.data.filter((row) => row.vertical === null || row.vertical === vertical)
  return [...own.data, ...fitting].map((row) => ({
    id: row.id,
    body: row.body,
    mix: parseMixText(row.mix),
    script: row.script,
    register: row.register,
    vertical: row.vertical,
    companyId: row.company_id,
  }))
}

export async function readTasks(scope: LeadScope): Promise<LeadTask[]> {
  const result = await scope.db
    .from('tasks')
    .select('id, title, type, due_at, done_at')
    .eq('workspace_id', scope.workspaceId)
    .eq('company_id', scope.companyId)
    .order('done_at', { ascending: false, nullsFirst: true })
    .order('due_at', { ascending: true, nullsFirst: false })
  if (result.error) throw fail(scope, 'tasks', result.error)
  return result.data.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    dueAt: row.due_at,
    doneAt: row.done_at,
  }))
}

export async function readActivities(scope: LeadScope): Promise<LeadActivity[]> {
  const result = await scope.db
    .from('activities')
    .select('id, type, body, occurred_at')
    .eq('workspace_id', scope.workspaceId)
    .eq('company_id', scope.companyId)
    .order('occurred_at', { ascending: false })
    .limit(TIMELINE_LIMIT)
  if (result.error) throw fail(scope, 'timeline', result.error)
  return result.data.map((row) => ({ id: row.id, type: row.type, body: row.body, occurredAt: row.occurred_at }))
}

/** Outcome of every call logged on this company. The calls table has no company column, so go through activities. */
export async function readCallOutcomes(scope: LeadScope): Promise<Outcome[]> {
  const activities = await scope.db
    .from('activities')
    .select('id')
    .eq('workspace_id', scope.workspaceId)
    .eq('company_id', scope.companyId)
    .eq('type', 'call')
  if (activities.error) throw fail(scope, 'call activities', activities.error)
  if (activities.data.length === 0) return []

  const calls = await scope.db
    .from('calls')
    .select('outcome')
    .eq('workspace_id', scope.workspaceId)
    .in('activity_id', activities.data.map((row) => row.id))
  if (calls.error) throw fail(scope, 'call outcomes', calls.error)
  return calls.data.map((row) => row.outcome)
}

export async function readWorkspaceMix(scope: LeadScope): Promise<Mix> {
  const result = await scope.db
    .from('workspaces')
    .select('default_language_mix')
    .eq('id', scope.workspaceId)
    .maybeSingle()
  if (result.error) throw fail(scope, 'workspace language mix', result.error)
  const mix: LangCode[] = result.data?.default_language_mix ?? []
  return mix.length > 0 ? mix : DEFAULT_WORKSPACE_MIX
}

export async function readVerticalDefault(
  scope: LeadScope,
  vertical: string | null,
): Promise<{ entryOffer: string | null; longTermOpportunity: string | null }> {
  if (!vertical) return { entryOffer: null, longTermOpportunity: null }
  const result = await scope.db
    .from('vertical_defaults')
    .select('entry_offer, long_term_opportunity')
    .eq('workspace_id', scope.workspaceId)
    .eq('vertical', vertical)
    .maybeSingle()
  if (result.error) throw fail(scope, 'vertical default', result.error)
  return {
    entryOffer: result.data?.entry_offer ?? null,
    longTermOpportunity: result.data?.long_term_opportunity ?? null,
  }
}
