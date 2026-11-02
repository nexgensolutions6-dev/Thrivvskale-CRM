'use client'

/**
 * The lead workspace's Timeline and Tasks tabs. Timeline holds the note box
 * and the activity history (calls, WhatsApp, notes, site re-checks); Tasks
 * lists the lead's tasks. Used by the /leads/[id] page with data from loadLead.
 */
import { useState } from 'react'
import type { LeadActivity, LeadTask } from '@/lib/leads/leadView'
import { NoteForm } from './NoteForm'
import { MUTED } from './styles'

type TabId = 'timeline' | 'tasks'

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'tasks', label: 'Tasks' },
]

export interface LeadTabsProps {
  companyId: string
  activities: LeadActivity[]
  tasks: LeadTask[]
}

export function LeadTabs({ companyId, activities, tasks }: LeadTabsProps) {
  const [active, setActive] = useState<TabId>('timeline')
  return (
    <section aria-label="Timeline and tasks" className="flex flex-col gap-3">
      <div role="tablist" aria-label="Lead history" className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`min-h-11 rounded-xl border border-current px-4 py-2 text-sm font-medium ${
              active === tab.id ? 'bg-[var(--glass-row-fill)] underline' : ''
            }`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="flex flex-col gap-3">
        {active === 'timeline' ? (
          <TimelinePanel companyId={companyId} activities={activities} />
        ) : (
          <TasksPanel tasks={tasks} />
        )}
      </div>
    </section>
  )
}

function TimelinePanel({ companyId, activities }: { companyId: string; activities: LeadActivity[] }) {
  return (
    <>
      <NoteForm companyId={companyId} />
      {activities.length === 0 ? (
        <p>Nothing has happened on this lead yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Activity history">
          {activities.map((activity) => (
            <li key={activity.id} className="glass-row flex flex-col gap-1 px-4 py-3">
              <span className={`text-xs ${MUTED}`}>
                {activityLabel(activity.type)} · {formatWhen(activity.occurredAt)}
              </span>
              {activity.body && <span className="min-w-0 whitespace-pre-wrap break-words">{activity.body}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function TasksPanel({ tasks }: { tasks: LeadTask[] }) {
  if (tasks.length === 0) return <p>No tasks for this lead.</p>
  return (
    <ul className="flex flex-col gap-2" aria-label="Tasks">
      {tasks.map((task) => (
        <li key={task.id} className="glass-row flex flex-col gap-1 px-4 py-3">
          <span className="min-w-0 break-words font-medium">{task.title}</span>
          <span className={`text-xs ${MUTED}`}>
            {task.type}
            {task.dueAt ? ` · due ${formatWhen(task.dueAt)}` : ''}
            {task.doneAt ? ' · done' : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

function activityLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase())
}

/** Date and time in India, the same for every viewer (and for the server render). */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}
