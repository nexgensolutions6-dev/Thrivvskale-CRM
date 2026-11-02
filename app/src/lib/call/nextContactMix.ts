/**
 * Works out the contact's next language mix after a call, using nextMixProfile
 * on the mixes spoken on their earlier calls plus this one. Returns the text
 * form to store, or null when this call teaches nothing. Called by
 * logCallInWorkspace before the transaction; log_call writes the result.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import type { Mix, Outcome } from '@/lib/domain'
import { nextMixProfile } from '@/lib/language/mix'
import { toMixText } from '@/lib/language/mixText'
import { stepError } from '@/lib/step-error'
import { CONVERSATION_OUTCOMES } from './conversationOutcomes'

const MODULE = 'nextContactMix'
/** nextMixProfile looks at the last 3 spoken mixes; this call is one of them. */
const EARLIER_CALLS = 2
/** Calls that taught nothing (no answer) are skipped, so read more than we need. */
const CALLS_TO_SCAN = 20

interface MixChange {
  workspaceId: string
  contactId: string
  currentMix: Mix
  outcome: Outcome
  mixUsed: Mix
}

export async function nextContactMix(db: SupabaseClient<Database>, change: MixChange): Promise<string | null> {
  if (!CONVERSATION_OUTCOMES.includes(change.outcome) || change.mixUsed.length === 0) return null
  const earlier = await readEarlierSpoken(db, change.workspaceId, change.contactId)
  return toMixText(nextMixProfile(change.currentMix, [...earlier, change.mixUsed]))
}

/** Oldest to newest, as nextMixProfile expects. */
async function readEarlierSpoken(db: SupabaseClient<Database>, workspaceId: string, contactId: string): Promise<Mix[]> {
  const activities = await db
    .from('activities')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .eq('type', 'call')
    .order('occurred_at', { ascending: false })
    .limit(CALLS_TO_SCAN)
  if (activities.error) throw stepError(MODULE, `read call activities of contact ${contactId}`, activities.error)

  const ids = activities.data.map((row) => row.id)
  const calls = await db.from('calls').select('activity_id, outcome, mix_used').in('activity_id', ids)
  if (calls.error) throw stepError(MODULE, `read calls of contact ${contactId}`, calls.error)

  const byActivity = new Map(calls.data.map((call) => [call.activity_id, call]))
  const spokenNewestFirst: Mix[] = []
  for (const id of ids) {
    const call = byActivity.get(id)
    if (call && CONVERSATION_OUTCOMES.includes(call.outcome) && call.mix_used.length > 0) {
      spokenNewestFirst.push(call.mix_used)
    }
  }
  return spokenNewestFirst.slice(0, EARLIER_CALLS).reverse()
}
