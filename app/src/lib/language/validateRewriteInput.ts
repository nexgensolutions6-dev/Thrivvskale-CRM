/**
 * `validateRewriteInput`: runtime check of the createAiDraft inputs, because
 * server actions are publicly callable and TS types are not enforced (mix is
 * interpolated into the model prompt). Throws naming the bad value. Called
 * first by createDraft, before any DB or model work.
 */
import { stepError } from '@/lib/step-error'

const MODULE = 'validateRewriteInput'
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LANG_CODES: readonly string[] = ['te', 'hi', 'kn', 'ta', 'ml', 'mr', 'ur', 'en']
const SCRIPTS: readonly string[] = ['latin', 'native']
const REGISTERS: readonly string[] = ['formal', 'casual']

export function validateRewriteInput(variantId: unknown, mix: unknown, script: unknown, register: unknown): void {
  if (typeof variantId !== 'string' || !UUID_SHAPE.test(variantId)) {
    throw stepError(MODULE, 'validate variantId', `must be a uuid string, got ${JSON.stringify(variantId)}`)
  }
  if (!Array.isArray(mix) || mix.length === 0) {
    throw stepError(MODULE, 'validate mix', `must be a non-empty array, got ${JSON.stringify(mix)}`)
  }
  for (const code of mix) {
    if (typeof code !== 'string' || !LANG_CODES.includes(code)) {
      throw stepError(MODULE, 'validate mix', `unknown language code ${JSON.stringify(code)}`)
    }
  }
  if (typeof script !== 'string' || !SCRIPTS.includes(script)) {
    throw stepError(MODULE, 'validate script', `must be one of ${SCRIPTS.join('|')}, got ${JSON.stringify(script)}`)
  }
  if (typeof register !== 'string' || !REGISTERS.includes(register)) {
    throw stepError(MODULE, 'validate register', `must be one of ${REGISTERS.join('|')}, got ${JSON.stringify(register)}`)
  }
}
