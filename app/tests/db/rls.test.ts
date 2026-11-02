import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  anonClient,
  cleanup,
  createUserWithWorkspace,
  localStack,
  type LocalStack,
  type TestUser,
} from './support'

/** Phase 1 tables that carry a `workspace_id` (spec Section 5). */
const WORKSPACE_TABLES = [
  'members',
  'companies',
  'contacts',
  'contact_points',
  'activities',
  'calls',
  'tasks',
  'pain_points',
  'content_variants',
  'objections',
  'holidays',
  'consent_log',
  'import_batches',
  'import_rows',
  'targets',
  'vertical_defaults',
]

const SETUP_TIMEOUT = 120_000

let stack: LocalStack
let db: pg.Client
let userA: TestUser
let userB: TestUser
let companyA: string
let companyB: string

async function insertCompany(user: TestUser, name: string): Promise<string> {
  const { data, error } = await user.client
    .from('companies')
    .insert({ workspace_id: user.workspaceId, name })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function logCall(
  user: TestUser,
  companyId: string,
  outcome: 'no_answer' | 'meeting_booked',
): Promise<void> {
  const activity = await user.client
    .from('activities')
    .insert({ workspace_id: user.workspaceId, company_id: companyId, type: 'call' })
    .select('id')
    .single()
  if (activity.error) throw activity.error
  const call = await user.client
    .from('calls')
    .insert({ workspace_id: user.workspaceId, activity_id: activity.data.id, outcome })
  if (call.error) throw call.error
}

beforeAll(async () => {
  stack = localStack()
  db = new pg.Client({ connectionString: stack.dbUrl })
  await db.connect()
  userA = await createUserWithWorkspace(stack, 'a')
  userB = await createUserWithWorkspace(stack, 'b')
  companyA = await insertCompany(userA, 'Alpha Interiors')
  companyB = await insertCompany(userB, 'Beta Clinics')
}, SETUP_TIMEOUT)

afterAll(async () => {
  const users = [userA, userB].filter((u): u is TestUser => u !== undefined)
  if (stack) await cleanup(stack, users)
  await db?.end()
}, SETUP_TIMEOUT)

describe('schema', () => {
  it('(a) enables row-level security on every public table with a workspace_id', async () => {
    const { rows } = await db.query<{ table_name: string; rls: boolean }>(`
      select c.relname as table_name, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and exists (
          select 1 from pg_attribute a
          where a.attrelid = c.oid and a.attname = 'workspace_id' and not a.attisdropped
        )
      order by 1
    `)
    const withoutRls = rows.filter((r) => !r.rls).map((r) => r.table_name)
    expect(withoutRls).toEqual([])
    // Guard against a vacuous pass: the Phase 1 tables must actually exist.
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(WORKSPACE_TABLES),
    )
  })

  it('enables row-level security on workspaces itself', async () => {
    const { rows } = await db.query<{ rls: boolean }>(
      `select relrowsecurity as rls from pg_class where oid = 'public.workspaces'::regclass`,
    )
    expect(rows).toEqual([{ rls: true }])
  })
})

describe('row-level security', () => {
  it('(b) user A sees their own company but not user B\'s', async () => {
    const own = await userA.client.from('companies').select('id').eq('id', companyA)
    expect(own.error).toBeNull()
    expect(own.data).toEqual([{ id: companyA }])

    const other = await userA.client.from('companies').select('id').eq('id', companyB)
    expect(other.error).toBeNull()
    expect(other.data).toEqual([])
  })

  it('(c) an anonymous client reads zero rows from companies', async () => {
    const { data, error } = await anonClient(stack).from('companies').select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('(d) user A cannot insert a company into user B\'s workspace', async () => {
    const { data, error } = await userA.client
      .from('companies')
      .insert({ workspace_id: userB.workspaceId, name: 'Intruder Ltd' })
      .select('id')
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('user A cannot attach a row in their workspace to user B\'s company', async () => {
    // Composite (workspace_id, company_id) foreign keys: FK checks bypass RLS,
    // so a plain company_id FK would accept B's id here.
    const { error } = await userA.client
      .from('contacts')
      .insert({ workspace_id: userA.workspaceId, company_id: companyB, name: 'Probe' })
    expect(error?.code).toBe('23503')
  })

  it('user A cannot see user B\'s workspace or membership', async () => {
    const ws = await userA.client.from('workspaces').select('id')
    expect(ws.error).toBeNull()
    expect(ws.data).toEqual([{ id: userA.workspaceId }])

    const members = await userA.client.from('members').select('workspace_id')
    expect(members.error).toBeNull()
    expect(members.data).toEqual([{ workspace_id: userA.workspaceId }])
  })

  it('scoreboard_daily only shows the caller\'s own workspace', async () => {
    await logCall(userA, companyA, 'meeting_booked')
    await logCall(userB, companyB, 'no_answer')

    const a = await userA.client.from('scoreboard_daily').select('*')
    expect(a.error).toBeNull()
    expect(a.data).toHaveLength(1)
    expect(a.data?.[0]).toMatchObject({
      workspace_id: userA.workspaceId,
      dials: 1,
      connects: 1,
      conversations: 1,
      meetings_booked: 1,
    })

    const anon = await anonClient(stack).from('scoreboard_daily').select('*')
    expect(anon.error).toBeNull()
    expect(anon.data).toEqual([])
  })
})

describe('idempotency', () => {
  it('(e) rejects a second activity with the same (workspace_id, client_id)', async () => {
    const row = {
      workspace_id: userA.workspaceId,
      company_id: companyA,
      type: 'note' as const,
      client_id: randomUUID(),
    }
    const first = await userA.client.from('activities').insert(row)
    expect(first.error).toBeNull()

    const second = await userA.client.from('activities').insert(row)
    expect(second.error?.code).toBe('23505')
  })
})
