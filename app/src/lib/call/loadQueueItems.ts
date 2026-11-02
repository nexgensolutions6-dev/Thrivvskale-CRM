/**
 * `loadQueueItems`: builds a QueueItem for every company of a workspace from
 * bulk reads (companies, contacts, numbers, past call outcomes). Uses the user's
 * client, so RLS applies. Called by loadCallScreen and the DB tests; ranking is
 * rankQueue's job.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import type { Mix, Outcome } from '@/lib/domain'
import { leadMix, type MixSource } from '@/lib/leads/contactMix'
import { pickPrimaryContact } from '@/lib/leads/primaryContact'
import { readWorkspaceMix } from '@/lib/leads/readLeadParts'
import type { QueueItem } from '@/lib/queue/types'
import { buildQueueItem, type QueueCompany } from './buildQueueItem'
import { readAllRows } from './readAllRows'

type Db = SupabaseClient<Database>

const COMPANY_COLUMNS =
  'id, tier, priority, base_score, vertical, area, website_status, intent_signal, ' +
  'dnd, needs_number, wrong_number, last_contacted_at, next_action_at'

function readCompanies(db: Db, workspaceId: string): Promise<QueueCompany[]> {
  return readAllRows<QueueCompany>('companies', (from, to) =>
    db.from('companies').select(COMPANY_COLUMNS).eq('workspace_id', workspaceId).order('id').range(from, to)
      .overrideTypes<QueueCompany[], { merge: false }>(),
  )
}

/** Each company's lead mix: primary contact's, else the workspace default. */
async function readCompanyMixes(db: Db, workspaceId: string, workspaceMix: Mix): Promise<Map<string, Mix>> {
  const rows = await readAllRows('contacts', (from, to) =>
    db.from('contacts').select('id, company_id, role, created_at, mix_profile, languages')
      .eq('workspace_id', workspaceId).order('id').range(from, to),
  )
  const byCompany = new Map<string, typeof rows>()
  for (const row of rows) byCompany.set(row.company_id, [...(byCompany.get(row.company_id) ?? []), row])

  const mixes = new Map<string, Mix>()
  for (const [companyId, contacts] of byCompany) {
    const primary = pickPrimaryContact(contacts.map((row) => ({ ...row, createdAt: row.created_at })))
    const source: MixSource | null = primary && { mixProfile: primary.mix_profile, languages: primary.languages }
    mixes.set(companyId, leadMix(source, workspaceMix))
  }
  return mixes
}

async function readCompaniesWithNumbers(db: Db, workspaceId: string): Promise<Set<string>> {
  const rows = await readAllRows('phone numbers', (from, to) =>
    db.from('contact_points').select('company_id').eq('workspace_id', workspaceId).order('id').range(from, to),
  )
  return new Set(rows.map((row) => row.company_id))
}

async function readOutcomesByCompany(db: Db, workspaceId: string): Promise<Map<string, Outcome[]>> {
  const rows = await readAllRows('call outcomes', (from, to) =>
    db.from('calls').select('outcome, activities!inner(company_id)')
      .eq('workspace_id', workspaceId).order('id').range(from, to),
  )
  const outcomes = new Map<string, Outcome[]>()
  for (const row of rows) {
    const companyId = row.activities.company_id
    outcomes.set(companyId, [...(outcomes.get(companyId) ?? []), row.outcome])
  }
  return outcomes
}

export async function loadQueueItems(db: Db, workspaceId: string): Promise<QueueItem[]> {
  const workspaceMix = await readWorkspaceMix({ db, workspaceId, companyId: '', companyName: 'workspace' })
  const [companies, mixes, withNumbers, outcomes] = await Promise.all([
    readCompanies(db, workspaceId),
    readCompanyMixes(db, workspaceId, workspaceMix),
    readCompaniesWithNumbers(db, workspaceId),
    readOutcomesByCompany(db, workspaceId),
  ])

  const items: QueueItem[] = []
  for (const company of companies) {
    const item = buildQueueItem(company, {
      outcomes: outcomes.get(company.id) ?? [],
      mix: mixes.get(company.id) ?? workspaceMix,
      hasNumber: withNumbers.has(company.id),
    })
    if (item) items.push(item)
  }
  return items
}
