'use client'

/**
 * Watches for the user coming back to the app after tapping a tel: link. Back
 * after 5 seconds or more calls `onPlaced` with the estimated length; sooner
 * means the call was not placed, so nothing happens. Used by LeadCallFlow.
 */
import { useCallback, useEffect, useRef } from 'react'
import { estimateDurationSeconds } from './duration'

export function useCallReturn(onPlaced: (seconds: number) => void): { markLeft: () => void; forget: () => void } {
  const leftAt = useRef<number | null>(null)

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible' || leftAt.current === null) return
      const seconds = estimateDurationSeconds(leftAt.current, Date.now())
      leftAt.current = null
      if (seconds !== null) onPlaced(seconds)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [onPlaced])

  const markLeft = useCallback(() => {
    leftAt.current = Date.now()
  }, [])
  const forget = useCallback(() => {
    leftAt.current = null
  }, [])
  return { markLeft, forget }
}
