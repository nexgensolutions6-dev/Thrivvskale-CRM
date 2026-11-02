/**
 * The website-status texts the app writes (they match the lead CSV's Website
 * Status column) and the prefix of the "broken website" intent signal. Used by
 * recheckSiteForCompany and nextIntentSignal.
 */

export const SITE_LOADS = 'Own site - loads'
export const SITE_FAILED = 'Own site - failed to load in check'

/** The CSV intent signal is "Broken/wrong website live on Google profile right now". */
export const BROKEN_SITE_SIGNAL_PREFIX = 'Broken/wrong website'
