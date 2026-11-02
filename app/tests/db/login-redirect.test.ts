/**
 * Runs the real route guard (`src/proxy.ts`) on `/login` against the local
 * Supabase stack. A visitor whose session cookie still looks valid but whose
 * user is gone must be shown the login form: bouncing them to `/today` would
 * start a loop (`/today` sends them to `/login`, `/login` sends them back).
 */
import { randomUUID } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/types'
import { nodeWebSocketOptions } from '@/lib/supabase/node-websocket-fallback'
import { proxy } from '@/proxy'
import {
  adminClient,
  deleteUserAndWorkspaces,
  exposeStackToApp,
  localStack,
  type Db,
  type LocalStack,
} from './support'

const SETUP_TIMEOUT = 120_000

let stack: LocalStack
let admin: Db
const createdUserIds: string[] = []

beforeAll(() => {
  stack = localStack()
  admin = adminClient(stack)
  exposeStackToApp(stack)
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (!admin) return
  for (const userId of createdUserIds) await deleteUserAndWorkspaces(stack, userId)
}, SETUP_TIMEOUT)

/** Creates a user and signs them in; returns their id and the session cookies a browser would hold. */
async function signedInUser(): Promise<{ userId: string; cookies: Map<string, string> }> {
  const email = `login-redirect-${randomUUID()}@example.test`
  const password = randomUUID()
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  createdUserIds.push(created.data.user.id)

  // The same cookie-based client the app uses, so the cookies have the real names and format.
  const cookies = new Map<string, string>()
  const supabase = createServerClient<Database>(stack.apiUrl, stack.anonKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) cookies.set(name, value)
      },
    },
    ...nodeWebSocketOptions,
  })
  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  if (cookies.size === 0) {
    throw new Error('[login-redirect test] sign in failed: no session cookies were written')
  }
  return { userId: created.data.user.id, cookies }
}

/** A GET /login request carrying the given cookies. */
function loginRequest(cookies: Map<string, string>): NextRequest {
  const request = new NextRequest('http://localhost:3000/login')
  for (const [name, value] of cookies) request.cookies.set(name, value)
  return request
}

describe('proxy on /login', () => {
  it('sends a visitor with a live session on to /today', async () => {
    const user = await signedInUser()

    const response = await proxy(loginRequest(user.cookies))

    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/today')
  })

  it('shows the login form when the session cookie is valid but the user is gone', async () => {
    const user = await signedInUser()
    const deleted = await admin.auth.admin.deleteUser(user.userId)
    expect(deleted.error).toBeNull()

    const response = await proxy(loginRequest(user.cookies))

    // No Location header: the visitor stays on /login instead of looping.
    expect(response.headers.get('location')).toBeNull()
    expect(response.status).toBe(200)
  })
})
