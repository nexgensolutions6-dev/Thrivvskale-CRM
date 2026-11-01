/**
 * /today - what needs doing now: due callbacks and tasks, the next lead to
 * call, today's scoreboard and the Mon-Sat week. Loads with the signed-in
 * user's client. The sign-in redirect lands here. Rendered inside the (app)
 * shell, which supplies <main>.
 */
import type { Metadata } from 'next'
import { Surface } from '@/components/glass/Surface'
import { Due } from '@/components/today/Due'
import { NextUp } from '@/components/today/NextUp'
import { Scoreboard } from '@/components/today/Scoreboard'
import { WeekCalendar } from '@/components/today/WeekCalendar'
import { getScoreboard } from '@/lib/scoreboard/getScoreboard'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { loadToday } from '@/lib/today/loadToday'
import { getSessionWorkspace } from '@/lib/workspace'

export const metadata: Metadata = { title: 'Today | ThrivvSkale CRM' }

export default async function TodayPage() {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  const today = await loadToday(db, workspaceId, new Date())
  const board = await getScoreboard(db, workspaceId, today.today)
  return (
    <div className="flex flex-col gap-4">
      <Surface level="L2" className="px-5 py-4">
        <h1 className="text-2xl font-semibold">Today</h1>
      </Surface>
      <Due items={today.due} />
      <NextUp lead={today.nextUp} />
      <Scoreboard board={board} />
      <WeekCalendar week={today.week} today={today.today} />
    </div>
  )
}
