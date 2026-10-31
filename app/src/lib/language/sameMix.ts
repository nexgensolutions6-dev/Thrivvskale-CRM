/**
 * Compares two language mixes as ordered lists (['te','en'] is not
 * ['en','te']). Used by pickVariant and nextMixProfile.
 */
import type { Mix } from '@/lib/domain'

export function sameMix(a: Mix, b: Mix): boolean {
  return a.length === b.length && a.every((lang, i) => lang === b[i])
}
