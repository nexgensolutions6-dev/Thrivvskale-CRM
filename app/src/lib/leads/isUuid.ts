/**
 * Runtime check that a value is a uuid string. Server actions are publicly
 * callable and TypeScript types are erased, so every id that arrives from a
 * client goes through this first. Used by the lead validators and loaders.
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_SHAPE.test(value)
}
