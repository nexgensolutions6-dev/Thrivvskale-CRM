/**
 * `validateConfirmInput`: runtime check of the confirmWhatsApp inputs, because
 * server actions are publicly callable and TS types are not enforced. Throws
 * naming the bad value. Called by confirmWhatsAppForPoint before any DB work.
 */
import { stepError } from '@/lib/step-error'

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateConfirmInput(contactPointId: unknown, hasWhatsApp: unknown): void {
  if (typeof contactPointId !== 'string' || !UUID_SHAPE.test(contactPointId)) {
    throw stepError('confirmWhatsApp', 'validate input', `contactPointId must be a uuid string, got ${JSON.stringify(contactPointId)}`)
  }
  if (typeof hasWhatsApp !== 'boolean') {
    throw stepError('confirmWhatsApp', 'validate input', `hasWhatsApp must be a boolean, got ${JSON.stringify(hasWhatsApp)}`)
  }
}
