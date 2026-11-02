'use client'

/**
 * React hook around the outbox: every outcome is queued first, then sent, so one
 * path covers online and offline. Flushes on load, on reconnect and on a timer
 * while anything waits. Refused outcomes are listed for the user; only those can
 * be removed. Runs in the browser only. Used by CallCockpit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { logCall } from '@/app/actions/logCall'
import { createOutbox, type DeadLetter, type OutboxOp } from './outbox'
import { isStuck } from './outboxStatus'
import { sendLogCall } from './sendLogCall'

const MODULE = 'useOutbox'
const RETRY_MS = 30_000

export interface OutboxState {
  waiting: OutboxOp[]
  /** Outcomes the server refused for good, kept until the user removes them. */
  refused: DeadLetter[]
  /** The oldest outcome could not be delivered; it will be tried again. */
  stuck: boolean
  submit: (op: OutboxOp) => Promise<void>
  removeRefused: (clientId: string) => Promise<void>
}

export function useOutbox(workspaceId: string): OutboxState {
  const box = useMemo(() => createOutbox(workspaceId), [workspaceId])
  const [waiting, setWaiting] = useState<OutboxOp[]>([])
  const [refused, setRefused] = useState<DeadLetter[]>([])
  const [stuck, setStuck] = useState(false)
  const flushing = useRef(false)

  const reload = useCallback(async () => {
    setWaiting(await box.pending())
    setRefused(await box.deadLetters())
  }, [box])

  const flushNow = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return
    flushing.current = true
    try {
      const result = await box.flush((op) => sendLogCall(op, logCall))
      setStuck(isStuck(result))
      await reload()
    } catch (error) {
      console.error(`[${MODULE}] flush the outbox failed`, error)
    } finally {
      flushing.current = false
    }
  }, [box, reload])

  useEffect(() => {
    const flushInBackground = () => void flushNow()
    Promise.all([box.pending(), box.deadLetters()])
      .then(([ops, letters]) => {
        setWaiting(ops)
        setRefused(letters)
      })
      .then(flushNow)
      .catch((error) => {
        console.error(`[${MODULE}] read the outbox failed`, error)
      })
    window.addEventListener('online', flushInBackground)
    const timer = window.setInterval(flushInBackground, RETRY_MS)
    return () => {
      window.removeEventListener('online', flushInBackground)
      window.clearInterval(timer)
    }
  }, [box, flushNow])

  const submit = useCallback(async (op: OutboxOp) => {
    try {
      await box.enqueue(op)
    } catch (error) {
      // No IndexedDB here (a private window, say): send directly. A failure reaches the sheet.
      console.warn(`[${MODULE}] queue the call on "${op.companyName}" failed, sending it directly`, error)
      const result = await sendLogCall(op, logCall)
      if (result) throw new Error(result.refused)
      return
    }
    await reload()
    void flushNow()
  }, [box, flushNow, reload])

  const removeRefused = useCallback(async (clientId: string) => {
    await box.removeDeadLetter(clientId)
    await reload()
  }, [box, reload])

  return { waiting, refused, stuck, submit, removeRefused }
}
