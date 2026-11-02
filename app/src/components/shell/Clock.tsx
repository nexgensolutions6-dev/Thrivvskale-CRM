'use client'
/**
 * The menu bar clock, in India time (the team works on Kolkata hours, wherever
 * the device is). Shows nothing on the server so the page cannot mismatch, then
 * ticks every 15 seconds. Used by MenuBar.
 */
import { useSyncExternalStore } from 'react'

const TICK_MS = 15_000

const CLOCK_FORMAT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

function subscribe(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, TICK_MS)
  return () => window.clearInterval(timer)
}

/** The current minute as an ISO string. Strings compare by value, so React re-renders once a minute. */
function currentMinute(): string {
  return `${new Date().toISOString().slice(0, 16)}Z`
}

export function Clock() {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => '')
  return (
    <time dateTime={minute || undefined} className="min-w-[4.5rem] text-right text-sm tabular-nums">
      {minute ? CLOCK_FORMAT.format(new Date(minute)) : ''}
    </time>
  )
}
