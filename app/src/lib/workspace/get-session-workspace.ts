/**
 * `getSessionWorkspace()`: who is signed in and which workspace they are
 * working in. Called at the top of server components and server actions that
 * touch data. Sends the visitor to the login page when nobody is signed in.
 */
import 'server-only'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { LOGIN_PATH } from '@/lib/auth/path-rules'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { ensureWorkspace } from './ensure-workspace'
import { findWorkspaceIdForUser } from './find-workspace-id'

/**
 * The user comes from `auth.getUser()`, which asks the auth server, never from
 * `auth.getSession()`, which only reads the cookie and so cannot be trusted on
 * the server. The workspace is looked up with the user's own session, so
 * row-level security applies. A signed-in user with no workspace (sign-in
 * worked but the callback's bootstrap did not finish) gets one created here.
 *
 * Wrapped in `cache` so one request asks the auth server only once, however
 * many components call it.
 */
export const getSessionWorkspace = cache(
  async (): Promise<{ userId: string; workspaceId: string }> => {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.auth.getUser()
    if (error && !isAuthSessionMissingError(error)) {
      console.warn(
        `[getSessionWorkspace] getUser failed, sending the visitor to ${LOGIN_PATH}: ${error.message}`,
      )
    }
    if (!data.user) redirect(LOGIN_PATH)

    const userId = data.user.id
    const workspaceId =
      (await findWorkspaceIdForUser(supabase, userId)) ?? (await ensureWorkspace(userId)).workspaceId

    return { userId, workspaceId }
  },
)
