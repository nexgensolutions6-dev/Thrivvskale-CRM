/**
 * Helpers for the database and e2e suites, which run against the local
 * Supabase stack. Every helper that uses the service-role key refuses to run
 * unless the stack is on 127.0.0.1 or localhost (see `assertLocalStack`).
 */
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import { WebSocket } from 'ws'
import type { Database } from '@/lib/db/types'
import { assertLocalStack, localStack, type LocalStack } from '../support/local-stack'

export { assertLocalStack, localStack, type LocalStack }

type ClientOptions = SupabaseClientOptions<'public'>
type Transport = NonNullable<ClientOptions['realtime']>['transport']

// supabase-js builds a realtime client eagerly and needs a WebSocket
// constructor. Node 22+ has one built in; on older Node (this project allows
// Node 20, and the pinned supabase-js 2.109.0 still throws there) fall back to
// `ws`.
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
  assertLocalStack(stack)
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

/**
 * Points the app code under test (the modules in `src/lib`) at the local
 * stack, the way .env.local does for a running app. Call it in `beforeAll`.
 */
export function exposeStackToApp(stack: LocalStack): void {
  assertLocalStack(stack)
  process.env.NEXT_PUBLIC_SUPABASE_URL = stack.apiUrl
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = stack.anonKey
  process.env.SUPABASE_SERVICE_ROLE_KEY = stack.serviceRoleKey
}

/** Deletes a user and every workspace they belong to (child rows cascade). Safe to call twice. */
export async function deleteUserAndWorkspaces(stack: LocalStack, userId: string): Promise<void> {
  const admin = adminClient(stack)
  const memberships = await admin.from('members').select('workspace_id').eq('user_id', userId)
  if (memberships.error) throw memberships.error
  const workspaceIds = memberships.data.map((member) => member.workspace_id)
  if (workspaceIds.length > 0) {
    const removed = await admin.from('workspaces').delete().in('id', workspaceIds)
    if (removed.error) throw removed.error
  }
  const deleted = await admin.auth.admin.deleteUser(userId)
  // A test may already have deleted the user on purpose; that is fine.
  if (deleted.error && deleted.error.status !== 404) throw deleted.error
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
