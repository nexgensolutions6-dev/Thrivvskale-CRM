/**
 * `ensureWorkspace(userId)`: gives a user a workspace and an owner membership
 * the first time they sign in, and does nothing on every later call. Called by
 * the auth callback route (right after sign-in) and by `getSessionWorkspace`
 * (as a safety net if the callback could not finish).
 */
import 'server-only'
import { seedWorkspaceContent } from '@/lib/content/seedWorkspaceContent'
import type { Mix } from '@/lib/domain'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { stepError } from '@/lib/step-error'
import { findWorkspaceIdForUser } from './find-workspace-id'
import { workspaceIdForUser } from './workspace-id'

const MODULE = 'ensureWorkspace'

/** Postgres error code for "a row with this key already exists". */
const UNIQUE_VIOLATION = '23505'

const DEFAULT_WORKSPACE = {
  name: 'My workspace',
  home_state: 'Telangana',
  default_language_mix: ['te', 'hi', 'en'] satisfies Mix,
  /** ISO weekdays: Monday to Saturday. */
  working_days: [1, 2, 3, 4, 5, 6],
  timezone: 'Asia/Kolkata',
}

/**
 * Idempotent and race-safe: any number of simultaneous calls for one user end
 * with one workspace and one `owner` member row.
 *
 * It uses the service-role client because the schema has no insert policy on
 * `workspaces` or `members` (users must not enrol themselves).
 *
 * How the race is handled, with no extra database constraint:
 *  1. A user who already belongs to a workspace gets that one back.
 *  2. Otherwise the new workspace gets an id derived from the user id
 *     (`workspaceIdForUser`), so simultaneous calls insert the same primary
 *     key. One insert wins; the others get a unique violation and carry on
 *     with the winner's row.
 *  3. The owner row is written with "ignore if it already exists" on
 *     (workspace_id, user_id), which is unique too.
 * If a call stops between steps 2 and 3, the next call completes step 3.
 */
export async function ensureWorkspace(userId: string): Promise<{ workspaceId: string }> {
  const db = createSupabaseAdminClient()

  const existingId = await findWorkspaceIdForUser(db, userId)
  if (existingId) return { workspaceId: existingId }

  const workspaceId = workspaceIdForUser(userId)

  const workspace = await db.from('workspaces').insert({ id: workspaceId, ...DEFAULT_WORKSPACE })
  const lostTheRace = workspace.error?.code === UNIQUE_VIOLATION
  if (workspace.error && !lostTheRace) {
    throw stepError(MODULE, 'insert workspace', workspace.error)
  }

  const member = await db
    .from('members')
    .upsert(
      { workspace_id: workspaceId, user_id: userId, role: 'owner' },
      { onConflict: 'workspace_id,user_id', ignoreDuplicates: true },
    )
  if (member.error) throw stepError(MODULE, 'insert member', member.error)

  // Only the call that created the workspace seeds it. A healed workspace is
  // deliberately left unseeded: mark it so the sign-in retry skips it.
  if (!lostTheRace) await seedStarterContent(workspaceId)
  else await markUnseeded(workspaceId)

  return { workspaceId }
}

/**
 * A failed seed must not stop the user signing in: they get an empty library
 * and the error is logged with the workspace id. Seeding is safe to rerun.
 */
async function seedStarterContent(workspaceId: string): Promise<void> {
  try {
    await seedWorkspaceContent(workspaceId)
  } catch (error) {
    console.error(`[${MODULE}] seed starter content for workspace ${workspaceId} failed`, error)
  }
}

/** Marks a healed workspace as done without seeding it (sets `content_seeded_at`). */
async function markUnseeded(workspaceId: string): Promise<void> {
  const db = createSupabaseAdminClient()
  const marked = await db
    .from('workspaces')
    .update({ content_seeded_at: new Date().toISOString() })
    .eq('id', workspaceId)
    .is('content_seeded_at', null)
  if (marked.error) throw stepError(MODULE, `mark healed workspace ${workspaceId} as not seeded`, marked.error)
}
