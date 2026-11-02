/**
 * The numbers for the menu bar's targets chip: calls made today (Kolkata day)
 * and the call target. If they cannot be read the chip hides its numbers rather
 * than breaking every screen; the error is logged. Uses the user's client, so
 * RLS applies. Called by the (app) layout.
 */
import { kolkataYmd } from '@/lib/calendar/kolkataDate'
import { getScoreboard } from '@/lib/scoreboard/getScoreboard'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'

const MODULE = 'loadMenuTargets'

export type MenuTargets = { callsDone: number; callsGoal: number }

export async function loadMenuTargets(workspaceId: string): Promise<MenuTargets | null> {
  try {
    const db = await createSupabaseServerClient()
    const board = await getScoreboard(db, workspaceId, kolkataYmd(new Date()))
    return { callsDone: board.calls, callsGoal: board.targets.calls }
  } catch (error) {
    console.error(`[${MODULE}] read today's targets failed:`, error)
    return null
  }
}
