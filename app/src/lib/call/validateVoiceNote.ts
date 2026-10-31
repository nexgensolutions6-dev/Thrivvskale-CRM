/**
 * Runtime check of a voice-note upload: a uuid company id and a webm audio Blob
 * under the size cap. The Blob's type label comes from the client, so the file's
 * first bytes are checked too. Throws naming the bad value. Called by saveVoiceNote.
 */
import { isUuid } from '@/lib/leads/isUuid'
import { stepError } from '@/lib/step-error'

const MODULE = 'validateVoiceNote'
const WEBM_TYPE = 'audio/webm'
/** Every webm file starts with this EBML marker. */
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3]

/** Same cap as the voice-notes bucket; must stay under the server action body limit in next.config.ts. */
export const MAX_VOICE_NOTE_BYTES = 5 * 1024 * 1024

export interface VoiceNoteUpload {
  companyId: string
  bytes: Uint8Array
}

function isWebmType(type: string): boolean {
  return type.split(';')[0].trim().toLowerCase() === WEBM_TYPE
}

export async function validateVoiceNote(companyId: unknown, audio: unknown): Promise<VoiceNoteUpload> {
  if (!isUuid(companyId)) {
    throw stepError(MODULE, 'validate companyId', `must be a uuid, got ${JSON.stringify(companyId)}`)
  }
  if (!(audio instanceof Blob)) throw stepError(MODULE, 'validate audio', 'must be a Blob')
  if (audio.size === 0) throw stepError(MODULE, 'validate audio', 'the recording is empty')
  if (audio.size > MAX_VOICE_NOTE_BYTES) {
    throw stepError(MODULE, 'validate audio', `too large (${audio.size} bytes, limit ${MAX_VOICE_NOTE_BYTES})`)
  }
  if (!isWebmType(audio.type)) {
    throw stepError(MODULE, 'validate audio', `type must be ${WEBM_TYPE}, got ${JSON.stringify(audio.type)}`)
  }
  const bytes = new Uint8Array(await audio.arrayBuffer())
  if (!WEBM_MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw stepError(MODULE, 'validate audio', 'the bytes are not a webm file')
  }
  return { companyId, bytes }
}
