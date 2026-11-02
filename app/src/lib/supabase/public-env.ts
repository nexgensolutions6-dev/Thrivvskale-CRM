/**
 * Reads the two public Supabase settings (project URL and anon key) from the
 * environment. Called by the browser client, the server client and the proxy
 * session refresh. Both are NEXT_PUBLIC_* because the browser needs them; the
 * service-role key is never read here (see `admin-client.ts`).
 */

const SETUP_HINT =
  'Copy .env.example to .env.local and fill it in (`npm run env:local` does it from the local Supabase stack).'

export function supabasePublicEnv(): { url: string; anonKey: string } {
  // Written out in full so Next can inline them into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!url || !anonKey) {
    throw new Error(
      `[supabase/public-env] read settings failed: ${missing.join(' and ')} not set. ${SETUP_HINT}`,
    )
  }
  return { url, anonKey }
}
