/**
 * Renews the visitor's Supabase session cookies for one request and says
 * whether they are signed in. Called only by the route guard, `src/proxy.ts`.
 */
import { createServerClient } from '@supabase/ssr'
import { isAuthSessionMissingError, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/db/types'
import { nodeWebSocketOptions } from './node-websocket-fallback'
import { supabasePublicEnv } from './public-env'

export interface RefreshedSession {
  /** Pass-through response that carries any refreshed session cookies. */
  response: NextResponse
  signedIn: boolean
}

/**
 * How sure the caller needs to be that the visitor is signed in.
 *  - `claims`: verify the token's signature on this server. No network call,
 *    but a token stays "valid" until it expires even after its user was
 *    deleted, banned or signed out elsewhere.
 *  - `auth-server`: ask the auth server with `getUser()`. One network call, and
 *    the answer is final. See "Redirect loop" in `src/proxy.ts` for why the
 *    login page needs it.
 */
export type SessionCheck = 'claims' | 'auth-server'

/**
 * The access token is short lived, so something must renew it on every request
 * and write the new cookies back; that is this function's job. `check` picks
 * how `signedIn` is decided. Code that touches data re-checks with `getUser()`
 * itself (see `workspace/get-session-workspace.ts`).
 */
export async function refreshSession(
  request: NextRequest,
  check: SessionCheck,
): Promise<RefreshedSession> {
  let response = NextResponse.next({ request })
  const { url, anonKey } = supabasePublicEnv()

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, cacheHeaders) => {
        // Later code in this request must see the new cookies...
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        // ...and so must the browser.
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        // Headers that stop a CDN from caching a response that sets cookies.
        for (const [name, value] of Object.entries(cacheHeaders)) {
          response.headers.set(name, value)
        }
      },
    },
    ...nodeWebSocketOptions,
  })

  const signedIn =
    check === 'auth-server' ? await authServerKnowsUser(supabase) : await tokenIsValid(supabase)
  return { response, signedIn }
}

type Client = SupabaseClient<Database>

/** `claims` check: is the session token well formed, signed and unexpired? */
async function tokenIsValid(supabase: Client): Promise<boolean> {
  const { data, error } = await supabase.auth.getClaims()
  if (error) {
    console.warn(`[refreshSession] getClaims failed, treating the visitor as signed out: ${error.message}`)
  }
  return Boolean(data?.claims)
}

/** `auth-server` check: does the auth server still know the user this token was issued to? */
async function authServerKnowsUser(supabase: Client): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  // "No session cookie at all" is the normal signed-out case, not worth a log line.
  if (error && !isAuthSessionMissingError(error)) {
    console.warn(`[refreshSession] getUser failed, treating the visitor as signed out: ${error.message}`)
  }
  return Boolean(data.user)
}
