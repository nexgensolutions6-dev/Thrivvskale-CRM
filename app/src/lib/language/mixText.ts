/**
 * Converts a Mix (['te','hi','en']) to the database text form 'te+hi+en'.
 * Called by the AI draft modules in this folder.
 */
import type { Mix } from '@/lib/domain'

export function toMixText(mix: Mix): string {
  return mix.join('+')
}
