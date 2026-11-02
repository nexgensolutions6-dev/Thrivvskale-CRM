/**
 * /more/targets - edit the daily call, conversation and demo targets that the
 * Today scoreboard and the menu bar measure against. Loads with the signed-in
 * user's client. Rendered inside the (app) shell.
 */
import type { Metadata } from 'next'
import { Surface } from '@/components/glass/Surface'
import { kolkataYmd } from '@/lib/calendar/kolkataDate'
import { readTargetRows } from '@/lib/scoreboard/readTargetRows'
import { targetOn } from '@/lib/scoreboard/targetOn'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'
import { TargetsForm } from './targets-form'

export const metadata: Metadata = { title: 'Daily targets | ThrivvSkale CRM' }

export default async function TargetsPage() {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  const rows = await readTargetRows(db, workspaceId)
  return (
    <Surface level="L3" className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Daily targets</h1>
      <p>These are the numbers your Today scoreboard and the top bar count against. Changes apply from today.</p>
      <TargetsForm current={targetOn(rows, kolkataYmd(new Date()))} />
    </Surface>
  )
}
