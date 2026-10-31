import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getSessionWorkspace } from '@/lib/workspace/get-session-workspace'
import { workspaceIdForUser } from '@/lib/workspace/workspace-id'
import {
  adminClient,
  anonClient,
  cleanup,
  createUserWithWorkspace,
  deleteUserAndWorkspaces,
  exposeStackToApp,
  localStack,
  type Db,
  type LocalStack,
  type TestUser,
} from './support'

const SETUP_TIMEOUT = 120_000

// getSessionWorkspace gets its Supabase client from the request's cookies, and
// there is no request here. Each test hands it the signed-in client it wants it
// to see; everything else (getUser, row-level security, ensureWorkspace) is real.
const request = vi.hoisted(() => ({ client: undefined as unknown }))
vi.mock('@/lib/supabase/server-client', () => ({
  createSupabaseServerClient: async () => request.client,
}))
// redirect() throws inside Next; do the same so a redirect stops the function.
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`)
  },
}))

let stack: LocalStack
let admin: Db
const members: TestUser[] = []
const bareUserIds: string[] = []

beforeAll(() => {
  stack = localStack()
  admin = adminClient(stack)
  exposeStackToApp(stack)
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (!admin) return
  for (const userId of bareUserIds) {
    await admin.from('workspaces').delete().eq('id', workspaceIdForUser(userId))
    await deleteUserAndWorkspaces(stack, userId)
  }
  await cleanup(stack, members)
}, SETUP_TIMEOUT)

/** A signed-in user who has no workspace yet (sign-in worked, bootstrap did not). */
async function signedInUserWithoutWorkspace(): Promise<{ userId: string; client: Db }> {
  const email = `session-${randomUUID()}@example.test`
  const password = randomUUID()
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  bareUserIds.push(created.data.user.id)

  const client = anonClient(stack)
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  return { userId: created.data.user.id, client }
}

describe('getSessionWorkspace', () => {
  it('returns the signed-in user and the workspace they belong to', async () => {
    const user = await createUserWithWorkspace(stack, 'session-member')
    members.push(user)
    request.client = user.client

    await expect(getSessionWorkspace()).resolves.toEqual({
      userId: user.userId,
      workspaceId: user.workspaceId,
    })
  })

  it('creates the workspace when a signed-in user does not have one yet', async () => {
    const user = await signedInUserWithoutWorkspace()
    request.client = user.client

    const result = await getSessionWorkspace()

    expect(result).toEqual({
      userId: user.userId,
      workspaceId: workspaceIdForUser(user.userId),
    })
    const owned = await admin.from('members').select('role').eq('user_id', user.userId)
    expect(owned.data).toEqual([{ role: 'owner' }])
  })

  it('redirects to /login when nobody is signed in', async () => {
    request.client = anonClient(stack)

    await expect(getSessionWorkspace()).rejects.toThrow('REDIRECT /login')
  })

  it('asks the auth server who is signed in instead of trusting the cookie', async () => {
    // A session cookie outlives the account it was issued to. Reading the cookie
    // (getSession) would still say "signed in"; asking the auth server (getUser)
    // knows the account is gone.
    const user = await signedInUserWithoutWorkspace()
    request.client = user.client
    const deleted = await admin.auth.admin.deleteUser(user.userId)
    expect(deleted.error).toBeNull()

    await expect(getSessionWorkspace()).rejects.toThrow('REDIRECT /login')
  })
})
