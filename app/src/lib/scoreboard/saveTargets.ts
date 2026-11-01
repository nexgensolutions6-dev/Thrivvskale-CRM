/**
 * Saves the daily targets as the row effective from today's Kolkata date
 * (written explicitly: the column default is the UTC date). Saving twice on one
 * day updates that row. Uses the user's client, so RLS applies. Called by the
 * Targets server action and the DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { kolkataYmd } from '@/lib/calendar/kolkataDate'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { validateTargets } from './validateTargets'

const MODULE = 'saveTargets'

export async function saveTargets(
  db: SupabaseClient<Database>,
  workspaceId: string,
  raw: unknown,
  now: Date,
): Promise<void> {
  const targets = validateTargets(raw)
  const result = await db.from('targets').upsert(
    {
      workspace_id: workspaceId,
      effective_from: kolkataYmd(now),
      dials: targets.calls,
      conversations: targets.conversations,
      meetings_booked: targets.demos,
    },
    { onConflict: 'workspace_id,effective_from' },
  )
  if (result.error) throw stepError(MODULE, 'save targets', result.error)
}
