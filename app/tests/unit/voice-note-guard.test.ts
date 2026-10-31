/**
 * Unit tests for voiceNoteSaveBlock: saving an outcome moves on to the next lead
 * and drops the recording held in memory, so every stage with live audio blocks.
 */
import { describe, expect, it } from 'vitest'
import { voiceNoteSaveBlock } from '@/lib/call/voiceNoteGuard'

describe('voiceNoteSaveBlock', () => {
  it.each(['recording', 'saving', 'unsent'] as const)('blocks saving while the note is %s', (stage) => {
    expect(voiceNoteSaveBlock(stage)).not.toBeNull()
  })

  it.each(['idle', 'saved', 'failed'] as const)('allows saving when the note is %s', (stage) => {
    expect(voiceNoteSaveBlock(stage)).toBeNull()
  })

  it('tells the user how to clear an unsent note', () => {
    expect(voiceNoteSaveBlock('unsent')).toMatch(/Try again.*discard/i)
  })
})
