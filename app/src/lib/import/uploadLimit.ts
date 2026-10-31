/**
 * The largest lead file the Import screen accepts, and the message shown when
 * a file is bigger. Used by readLeadUpload (server) and the Import form
 * (browser), so both refuse with the same words. Next rejects a larger body
 * before the action runs, so the form must check first.
 */

/** The real file is about 300 KB; this leaves room to grow and stays under the action's body limit. */
export const MAX_UPLOAD_BYTES = 1_500_000

/** The message for a file over the limit, or null when the size is fine. */
export function oversizeMessage(file: { name: string; size: number }): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null
  return `"${file.name}" is too large (limit ${MAX_UPLOAD_BYTES / 1_000_000} MB).`
}
