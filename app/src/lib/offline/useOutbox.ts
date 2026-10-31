'use client'

/**
 * React hook around the outbox: every outcome is queued first, then sent, so one
 * path covers online and offline. Flushes on load, on reconnect and on a timer
 * while anything waits. Runs in the browser only. Used by CallCockpit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { logCall } from '@/app/actions/logCall'
import { createOutbox, type OutboxOp } from './outbox'

const MODULE = 'useOutbox'
const RETRY_MS = 30_000

export interface OutboxState {
  waiting: OutboxOp[]
  /** The oldest outcome failed while online: the server may be refusing it. */
  stuck: boolean
  submit: (op: OutboxOp) => Promise<void>
  discardOldest: () => Promise<void>
}

export function useOutbox(workspaceId: string): OutboxState {
  const box = useMemo(() => createOutbox(workspaceId), [workspaceId])
  const [waiting, setWaiting] = useState<OutboxOp[]>([])
  const [stuck, setStuck] = useState(false)
  const flushing = useRef(false)

  const reload = useCallback(async () => {
    setWaiting(await box.pending())
  }, [box])

  const flushNow = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return
    flushing.current = true
    try {
      const result = await box.flush(async (op) => {
        await logCall(op.payload)
      })
      setStuck(result.failed > 0)
      await reload()
    } catch (error) {
      console.error(`[${MODULE}] flush the outbox failed`, error)
    } finally {
      flushing.current = false
    }
  }, [box, reload])

  useEffect(() => {
    const flushInBackground = () => void flushNow()
    box.pending().then(setWaiting).then(flushNow).catch((error) => {
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
      console.warn(`[${MODULE}] queue ${op.clientId} failed, sending it directly`, error)
      await logCall(op.payload)
      return
    }
    await reload()
    void flushNow()
  }, [box, flushNow, reload])

  const discardOldest = useCallback(async () => {
    const oldest = waiting[0]
    if (!oldest) return
    await box.remove(oldest.clientId)
    setStuck(false)
    await reload()
    void flushNow()
  }, [box, flushNow, reload, waiting])

  return { waiting, stuck, submit, discardOldest }
}
