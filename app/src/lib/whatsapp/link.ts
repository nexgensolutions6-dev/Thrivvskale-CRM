/**
 * `buildWaLink`: the click-to-chat link for one phone point, or null when the
 * point cannot receive WhatsApp. Called by the calling cockpit UI. Pure.
 */
import type { WaStatus } from '@/lib/domain'
import { plainWaUrl, waUrlWithText } from './waUrl'

/** Longest URL we hand to a browser or WhatsApp; longer messages are copy-paste only. */
export const MAX_WA_URL_LENGTH = 2000

export interface WaLink {
  url: string
  /** True when the message was too long for a link: the URL has no text, the UI offers Copy. */
  copyOnly: boolean
}

export function buildWaLink(point: { e164: string; waStatus: WaStatus }, text: string): WaLink | null {
  // The stored status is authoritative: a landline or confirmed-none number never gets a link.
  if (point.waStatus === 'landline' || point.waStatus === 'none') return null

  const fullUrl = waUrlWithText(point.e164, text)
  if (fullUrl.length > MAX_WA_URL_LENGTH) {
    return { url: plainWaUrl(point.e164), copyOnly: true }
  }
  return { url: fullUrl, copyOnly: false }
}
