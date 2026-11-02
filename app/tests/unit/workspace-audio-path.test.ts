/**
 * Unit tests for isWorkspaceAudioPath: removeErasedAudio deletes a voice-note
 * file only when its path is inside the workspace's own folder and has no
 * "." or ".." step.
 */
import { describe, expect, it } from 'vitest'
import { isWorkspaceAudioPath } from '@/lib/privacy/isWorkspaceAudioPath'

const WS = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

describe('isWorkspaceAudioPath', () => {
  it('accepts a file inside the workspace folder', () => {
    expect(isWorkspaceAudioPath(WS, `${WS}/abc.webm`)).toBe(true)
  })

  it.each([
    `${OTHER}/abc.webm`,
    `${WS}abc.webm`,
    `abc/${WS}/abc.webm`,
    `${WS}/../${OTHER}/abc.webm`,
    `${WS}/./abc.webm`,
    `${WS}//abc.webm`,
    `${WS}/`,
    '',
  ])('rejects %s', (path) => {
    expect(isWorkspaceAudioPath(WS, path)).toBe(false)
  })
})
