'use client'

/**
 * The call flow for one lead: the call card, then the outcome sheet when the
 * user returns from the dialer (not within 5 seconds: that call was not placed).
 * Keyed by company, so every choice here resets on the next lead. Used by CallCockpit.
 */
import { useCallback, useState } from 'react'
import { Surface } from '@/components/glass/Surface'
import type { CallLead, CallObjection } from '@/lib/call/callScreen'
import { useCallReturn } from '@/lib/call/useCallReturn'
import { voiceNoteSaveBlock, type VoiceNoteStage } from '@/lib/call/voiceNoteGuard'
import type { OutboxOp } from '@/lib/offline/outbox'
import { CallCard } from './CallCard'
import { OutcomeSheet } from './OutcomeSheet'
import { VoiceNoteButton } from './VoiceNoteButton'

type Sheet = { estimatedSeconds: number | null }

export interface LeadCallFlowProps {
  lead: CallLead
  objections: CallObjection[]
  onSubmit: (op: OutboxOp) => Promise<void>
}

export function LeadCallFlow({ lead, objections, onSubmit }: LeadCallFlowProps) {
  const [pointId, setPointId] = useState(lead.points[0].id)
  const [openerId, setOpenerId] = useState<string | null>(lead.openers[0]?.id ?? null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [voiceStage, setVoiceStage] = useState<VoiceNoteStage>('idle')
  const point = lead.points.find((option) => option.id === pointId) ?? lead.points[0]

  const openWithEstimate = useCallback((seconds: number) => setSheet({ estimatedSeconds: seconds }), [])
  const { markLeft, forget } = useCallReturn(openWithEstimate)

  return (
    <div className="flex flex-col gap-4">
      {sheet ? (
        <OutcomeSheet
          lead={lead}
          point={point}
          openerId={openerId}
          estimatedSeconds={sheet.estimatedSeconds}
          objections={objections}
          saveBlock={voiceNoteSaveBlock(voiceStage)}
          onCancel={() => setSheet(null)}
          onSubmit={onSubmit}
        />
      ) : (
        <CallCard
          lead={lead}
          point={point}
          onChoosePoint={setPointId}
          onChooseOpener={setOpenerId}
          onCallPressed={markLeft}
          onLogOutcome={() => {
            forget()
            setSheet({ estimatedSeconds: null })
          }}
        />
      )}
      <Surface level="L2" className="p-4">
        <VoiceNoteButton companyId={lead.companyId} onStageChange={setVoiceStage} />
      </Surface>
    </div>
  )
}
