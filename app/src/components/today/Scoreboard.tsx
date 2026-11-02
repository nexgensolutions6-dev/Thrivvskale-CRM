/**
 * Today's scoreboard: calls, connects, conversations and demos against the
 * daily targets, and the streak of days that met the call target. Shows
 * "done / goal" when a goal is set, else just the number. Used by the Today page.
 */
import Link from 'next/link'
import { Surface } from '@/components/glass/Surface'
import type { Scoreboard as ScoreboardData } from '@/lib/scoreboard/types'

function Metric({ id, label, done, goal }: { id: string; label: string; done: number; goal?: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm">{label}</dt>
      <dd data-testid={`score-${id}`} className="text-2xl font-semibold tabular-nums">
        {goal ? `${done} / ${goal}` : done}
      </dd>
    </div>
  )
}

export function Scoreboard({ board }: { board: ScoreboardData }) {
  const { targets } = board
  const streakLabel = board.streakDays === 1 ? '1 day' : `${board.streakDays} days`
  return (
    <Surface level="L2" data-testid="scoreboard" className="flex flex-col gap-3 p-5">
      <h2 className="text-lg font-semibold">Scoreboard</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Metric id="calls" label="Calls" done={board.calls} goal={targets.calls} />
        <Metric id="connects" label="Connects" done={board.connects} />
        <Metric id="conversations" label="Conversations" done={board.conversations} goal={targets.conversations} />
        <Metric id="demos" label="Demos" done={board.demos} goal={targets.demos} />
        <div className="flex flex-col">
          <dt className="text-sm">Streak</dt>
          <dd data-testid="score-streak" className="text-2xl font-semibold tabular-nums">{streakLabel}</dd>
        </div>
      </dl>
      <Link href="/more/targets" className="text-sm underline">Change daily targets</Link>
    </Surface>
  )
}
