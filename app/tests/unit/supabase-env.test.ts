import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { supabasePublicEnv } from '@/lib/supabase/public-env'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('supabasePublicEnv', () => {
  it('returns the project url and anon key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')

    expect(supabasePublicEnv()).toEqual({ url: 'http://127.0.0.1:54321', anonKey: 'anon-key' })
  })

  it('names the module and every missing variable', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

    expect(() => supabasePublicEnv()).toThrow(
      /^\[supabase\/public-env\] read settings failed: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY not set/,
    )
  })
})

describe('createSupabaseAdminClient', () => {
  it('needs SUPABASE_SERVICE_ROLE_KEY and says so', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    expect(() => createSupabaseAdminClient()).toThrow(
      /^\[supabase\/admin-client\] read settings failed: SUPABASE_SERVICE_ROLE_KEY not set/,
    )
  })

  it('never accepts the key from a NEXT_PUBLIC_ variable, which would reach the browser', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY', 'would-be-exposed')

    expect(() => createSupabaseAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY not set/)
  })
})
