/**
 * Helpers for the database suite (`npm run test:db`), which runs against the
 * local Supabase stack (`npx supabase start`).
 *
 * Connection details are never hard-coded: they come from the environment
 * (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL)
 * or, when those are not all set, from `npx supabase status -o env`.
 */
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import { WebSocket } from 'ws'
import type { Database } from '@/lib/db/types'

export interface LocalStack {
  apiUrl: string
  anonKey: string
  serviceRoleKey: string
  dbUrl: string
}

const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url))

function parseEnvOutput(output: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) vars[match[1]] = match[2].replace(/^"(.*)"$/, '$1')
  }
  return vars
}

function required(vars: Record<string, string | undefined>, key: string): string {
  const value = vars[key]
  if (!value) {
    throw new Error(
      `Missing ${key}. Is the local stack running? Try \`npx supabase start\`.`,
    )
  }
  return value
}

let cached: LocalStack | undefined

export function localStack(): LocalStack {
  if (cached) return cached
  const env = process.env
  if (
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    env.SUPABASE_DB_URL
  ) {
    cached = {
      apiUrl: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      dbUrl: env.SUPABASE_DB_URL,
    }
    return cached
  }
  const output = execSync('npx supabase status -o env', {
    cwd: APP_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const vars = parseEnvOutput(output)
  cached = {
    apiUrl: required(vars, 'API_URL'),
    anonKey: required(vars, 'ANON_KEY'),
    serviceRoleKey: required(vars, 'SERVICE_ROLE_KEY'),
    dbUrl: required(vars, 'DB_URL'),
  }
  return cached
}

type ClientOptions = SupabaseClientOptions<'public'>
type Transport = NonNullable<ClientOptions['realtime']>['transport']

// supabase-js builds a realtime client eagerly and needs a WebSocket
// constructor. Node 22+ has one built in; on older Node fall back to `ws`.
const CLIENT_OPTIONS: ClientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  ...(typeof globalThis.WebSocket === 'undefined'
    ? { realtime: { transport: WebSocket as unknown as Transport } }
    : {}),
}

function newClient(stack: LocalStack, key: string) {
  return createClient<Database>(stack.apiUrl, key, CLIENT_OPTIONS)
}

export type Db = ReturnType<typeof newClient>

/** Service-role client: bypasses RLS. Use only for test setup and teardown. */
export function adminClient(stack: LocalStack): Db {
  return newClient(stack, stack.serviceRoleKey)
}

/** Client with no session: the `anon` role. */
export function anonClient(stack: LocalStack): Db {
  return newClient(stack, stack.anonKey)
}

export interface TestUser {
  userId: string
  workspaceId: string
  /** Signed-in client for this user (the `authenticated` role, RLS applies). */
  client: Db
}

/**
 * Creates a throwaway user with a fresh workspace they own. The password is
 * random and lives only for the duration of the test run.
 */
export async function createUserWithWorkspace(
  stack: LocalStack,
  label: string,
): Promise<TestUser> {
  const admin = adminClient(stack)
  const email = `rls-${label}-${randomUUID()}@example.test`
  const password = randomUUID()

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error) throw created.error
  const userId = created.data.user.id

  const ws = await admin
    .from('workspaces')
    .insert({ name: `Test workspace ${label}` })
    .select('id')
    .single()
  if (ws.error) throw ws.error

  const member = await admin
    .from('members')
    .insert({ workspace_id: ws.data.id, user_id: userId, role: 'owner' })
  if (member.error) throw member.error

  const client = newClient(stack, stack.anonKey)
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error

  return { userId, workspaceId: ws.data.id, client }
}

/** Deletes the users and their workspaces (child rows cascade). */
export async function cleanup(stack: LocalStack, users: TestUser[]): Promise<void> {
  const admin = adminClient(stack)
  for (const user of users) {
    await user.client.auth.signOut()
    await admin.from('workspaces').delete().eq('id', user.workspaceId)
    await admin.auth.admin.deleteUser(user.userId)
  }
}
