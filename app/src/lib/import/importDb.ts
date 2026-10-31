/**
 * The Supabase client type the import modules work with: the signed-in
 * user's client, so row-level security keeps every query inside their
 * workspace. Used by importLeads and the modules it calls.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

export type ImportDb = SupabaseClient<Database>
