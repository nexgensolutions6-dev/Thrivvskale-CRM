/**
 * Supabase client for code running in the browser (a client component, used by
 * a visitor who is not signed in yet). Anon key only; row-level security
 * protects the data. Called by the login form to request the magic-link email.
 */
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/db/types'
import { supabasePublicEnv } from './public-env'

export function createSupabaseBrowserClient() {
  const { url, anonKey } = supabasePublicEnv()
  return createBrowserClient<Database>(url, anonKey)
}
