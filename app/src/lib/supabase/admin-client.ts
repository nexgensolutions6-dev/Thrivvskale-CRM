/**
 * Supabase client with the service-role key, which BYPASSES row-level security.
 * Server-only (browser imports fail the build); the key is read from
 * SUPABASE_SERVICE_ROLE_KEY, never a NEXT_PUBLIC_ variable. Called by
 * `workspace/ensure-workspace.ts`.
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { nodeWebSocketOptions } from './node-websocket-fallback'

/**
 * Needed because the schema deliberately has no insert policy on `workspaces`
 * or `members`: a user cannot enrol themselves, only this server code can.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error(
      `[supabase/admin-client] read settings failed: ${missing.join(' and ')} not set. ` +
        'Copy .env.example to .env.local and fill it in (`npm run env:local` does it from the local Supabase stack).',
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...nodeWebSocketOptions,
  })
}
