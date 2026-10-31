/**
 * The voice note stages and whether each one may hold up saving an outcome.
 * Saving moves on to the next lead and drops the recording held in memory, so a
 * stage with live audio blocks the save and says why. Used by LeadCallFlow.
 */
/** 'unsent' = a finished recording is still here, waiting for Try again or Discard. */
export type VoiceNoteStage = 'idle' | 'recording' | 'saving' | 'saved' | 'failed' | 'unsent'

const SAVE_BLOCKS: Partial<Record<VoiceNoteStage, string>> = {
  recording: 'Finish the voice note before saving.',
  saving: 'Wait for the voice note to finish saving.',
  unsent: 'The voice note has not been sent. Use Try again or discard it before saving.',
}

/** Why the outcome cannot be saved yet, or null when it can. */
export function voiceNoteSaveBlock(stage: VoiceNoteStage): string | null {
  return SAVE_BLOCKS[stage] ?? null
}
