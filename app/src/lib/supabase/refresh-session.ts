/**
 * Renews the visitor's Supabase session cookies for one request and says
 * whether they are signed in. Called only by the route guard, `src/proxy.ts`.
 */
import { createServerClient } from '@supabase/ssr'
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
 * The access token is short lived, so something must renew it on every request
 * and write the new cookies back; that is this function's job. It checks with
 * `getClaims()`, which verifies the token: enough to decide "page or login
 * form". Code that touches data re-checks with `getUser()` instead (see
 * `workspace/get-session-workspace.ts`).
 */
export async function refreshSession(request: NextRequest): Promise<RefreshedSession> {
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

  const { data, error } = await supabase.auth.getClaims()
  if (error) {
    console.warn(`[refreshSession] getClaims failed, treating the visitor as signed out: ${error.message}`)
  }

  return { response, signedIn: Boolean(data?.claims) }
}
