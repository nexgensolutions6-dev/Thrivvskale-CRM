/**
 * Supabase client for server components, route handlers and server actions. It
 * acts as the signed-in user: it reads the session from the request's cookies,
 * so row-level security applies. Called by `getSessionWorkspace` and by the
 * auth callback route. Create one per request; never share it.
 */
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/db/types'
import { nodeWebSocketOptions } from './node-websocket-fallback'
import { supabasePublicEnv } from './public-env'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = supabasePublicEnv()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server components cannot write cookies. That is fine: the proxy
          // (`refresh-session.ts`) refreshes the session on every request.
        }
      },
    },
    ...nodeWebSocketOptions,
  })
}
