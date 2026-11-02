/**
 * The Monday to Saturday week: a six-column grid from 768px up, a stacked
 * agenda list below that (one list, restyled by CSS, so it never scrolls
 * sideways). Each day lists its open tasks. Used by the Today page.
 */
import { Surface } from '@/components/glass/Surface'
import { dayLabel } from '@/lib/today/dayLabel'
import type { WeekDay } from '@/lib/today/types'

export function WeekCalendar({ week, today }: { week: WeekDay[]; today: string }) {
  return (
    <Surface level="L2" className="flex flex-col gap-3 p-5">
      <h2 className="text-lg font-semibold">This week</h2>
      <ol data-testid="week-calendar" className="grid grid-cols-1 gap-3 md:grid-cols-6">
        {week.map(({ day, tasks }) => (
          <li key={day} data-day={day} aria-current={day === today ? 'date' : undefined} className="min-w-0">
            <p className="font-semibold">{dayLabel(day)}</p>
            {tasks.length === 0 ? (
              <p className="text-sm">Free</p>
            ) : (
              <div className="flex flex-col gap-1 text-sm">
                {tasks.map((task) => (
                  <p key={task.id} className="break-words">
                    {task.title}
                    {task.companyName ? ` (${task.companyName})` : ''}
                  </p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Surface>
  )
}
