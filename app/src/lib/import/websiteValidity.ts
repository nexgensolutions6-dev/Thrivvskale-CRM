/**
 * Decides the `websiteInvalid` flag for a lead's Website cell. Called by
 * mapLeadRow. The cell itself is kept as typed; only the flag is computed.
 */
import { isPlatformUrl } from '@/lib/import/platformDomains'
import { hostOfUrl } from '@/lib/import/websiteHost'

/** An empty cell is fine (no website). Junk is text that is no web address, or a platform page. */
export function isWebsiteInvalid(websiteUrl: string | null): boolean {
  if (websiteUrl === null) return false
  return hostOfUrl(websiteUrl) === null || isPlatformUrl(websiteUrl)
}
