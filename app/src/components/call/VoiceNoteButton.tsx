'use client'

/**
 * One-tap voice note: records webm audio and sends it to recordVoiceNote. Needs a
 * connection and is never queued offline; on failure the recording stays here so
 * "Try again" can resend it. Stops by itself at the time cap. Used by LeadCallFlow.
 */
import { useEffect, useRef, useState } from 'react'
import { recordVoiceNote } from '@/app/actions/voiceNote'
import { BUTTON } from '@/components/lead/styles'

const MODULE = 'VoiceNoteButton'
const RECORDER_TYPE = 'audio/webm;codecs=opus'
const AUDIO_TYPE = 'audio/webm'
/** About 2.4 MB at this rate, well under the 5 MB cap. */
const BITS_PER_SECOND = 32_000
const MAX_RECORD_MS = 10 * 60 * 1000

/** 'unsent' = a finished recording is still here, waiting for Try again. */
type Stage = 'idle' | 'recording' | 'saving' | 'saved' | 'failed' | 'unsent'

export interface VoiceNoteButtonProps {
  companyId: string
  onRecordingChange: (recording: boolean) => void
}

export function VoiceNoteButton({ companyId, onRecordingChange }: VoiceNoteButtonProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const recording = useRef<Blob | null>(null)
  const stopTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    window.clearTimeout(stopTimer.current)
    recorder.current?.stream.getTracks().forEach((track) => track.stop())
  }, [])

  function fail(stageAfter: Stage, text: string, error?: unknown) {
    if (error) console.error(`[${MODULE}] ${text}`, error)
    setStage(stageAfter)
    setMessage(text)
  }

  async function send() {
    const audio = recording.current
    if (audio === null) return
    if (!navigator.onLine) {
      fail('unsent', 'Voice notes need a connection. Try again when you are back online.')
      return
    }
    setStage('saving')
    try {
      await recordVoiceNote(companyId, audio)
      recording.current = null
      setStage('saved')
      setMessage(null)
    } catch (error) {
      fail('unsent', 'The voice note could not be saved. Try again.', error)
    }
  }

  function finishRecording(chunks: Blob[], stream: MediaStream) {
    window.clearTimeout(stopTimer.current)
    stream.getTracks().forEach((track) => track.stop())
    recorder.current = null
    onRecordingChange(false)
    recording.current = new Blob(chunks, { type: AUDIO_TYPE })
    void send()
  }

  async function start() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(RECORDER_TYPE)) {
      fail('failed', 'This browser cannot record voice notes.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const next = new MediaRecorder(stream, { mimeType: RECORDER_TYPE, audioBitsPerSecond: BITS_PER_SECOND })
      next.ondataavailable = (event) => chunks.push(event.data)
      next.onstop = () => finishRecording(chunks, stream)
      next.start()
      recorder.current = next
      stopTimer.current = window.setTimeout(() => next.stop(), MAX_RECORD_MS)
      setStage('recording')
      setMessage(null)
      onRecordingChange(true)
    } catch (error) {
      fail('failed', 'The microphone could not be started.', error)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {stage === 'recording' ? (
        <button type="button" className={BUTTON} onClick={() => recorder.current?.stop()}>Stop and save</button>
      ) : stage === 'unsent' ? (
        <button type="button" className={BUTTON} onClick={() => void send()}>Try again</button>
      ) : (
        <button type="button" className={BUTTON} disabled={stage === 'saving'} onClick={() => void start()}>
          {stage === 'saving' ? 'Saving voice note...' : 'Record voice note'}
        </button>
      )}
      {stage === 'saved' && <span role="status" className="text-sm">Voice note saved</span>}
      {message && <span role="alert" className="break-words text-sm">{message}</span>}
    </div>
  )
}
