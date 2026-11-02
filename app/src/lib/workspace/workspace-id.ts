/**
 * Works out the id of the workspace a user owns by default (the same user
 * always gets the same id). Called by `ensure-workspace.ts`.
 */
import { createHash } from 'node:crypto'

/** Fixed namespace for workspace ids. Never change it: existing ids came from it. */
const WORKSPACE_NAMESPACE = '5b0f6f4e-3f8a-4c52-9a43-6e2c1d7b9a10'

/**
 * Deriving the id from the user id is what makes workspace creation race-safe
 * without an extra database constraint: two simultaneous first sign-ins both
 * try to insert the same primary key, one wins, and the other carries on with
 * the winner's row.
 */
export function workspaceIdForUser(userId: string): string {
  return uuidV5(userId.toLowerCase(), WORKSPACE_NAMESPACE)
}

/**
 * Name-based UUID, version 5 (RFC 4122): SHA-1 of the namespace bytes followed
 * by the name, with the version and variant bits stamped in. The same name
 * always gives the same UUID. Exported so a unit test can check it against the
 * RFC's published answer.
 */
export function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const digest = createHash('sha1').update(namespaceBytes).update(name, 'utf8').digest()

  const bytes = digest.subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // top nibble of byte 6 = version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // top two bits of byte 8 = RFC 4122 variant

  const hex = bytes.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}
