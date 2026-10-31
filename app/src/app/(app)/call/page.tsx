/**
 * /call - the calling cockpit. Loads the ranked queue on the server with the
 * signed-in user's client and hands a prepared batch of leads to CallCockpit.
 * Rendered inside the (app) shell, which supplies <main>.
 */
import type { Metadata } from 'next'
import { CallCockpit } from '@/components/call/CallCockpit'
import { loadCallScreen } from '@/lib/call/loadCallScreen'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export const metadata: Metadata = { title: 'Call | ThrivvSkale CRM' }

export default async function CallPage() {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  const screen = await loadCallScreen(db, workspaceId, new Date())
  return (
    <>
      <h1 className="sr-only">Call</h1>
      <CallCockpit workspaceId={workspaceId} screen={screen} />
    </>
  )
}
