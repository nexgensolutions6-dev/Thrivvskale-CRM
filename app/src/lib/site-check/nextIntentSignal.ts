/**
 * Decides a company's intent signal after a website re-check. The only change:
 * when the site went from "failed to load" to "loads", the "Broken/wrong
 * website..." signal is gone (null). Any other signal is kept. Pure. Called by
 * recheckSiteForCompany. The signal is the text in companies.intent_signal.
 */
import { BROKEN_SITE_SIGNAL_PREFIX, SITE_FAILED, SITE_LOADS } from './websiteStatus'

export function nextIntentSignal(
  current: string | null,
  previousStatus: string | null,
  newStatus: string,
): string | null {
  const wasFailed = previousStatus === SITE_FAILED
  const nowLoads = newStatus === SITE_LOADS
  const isBrokenSiteSignal = current !== null && current.startsWith(BROKEN_SITE_SIGNAL_PREFIX)
  return wasFailed && nowLoads && isBrokenSiteSignal ? null : current
}
