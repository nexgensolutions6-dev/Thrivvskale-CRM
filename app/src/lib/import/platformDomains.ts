/**
 * Domains that are a platform, not a business's own website: directories,
 * social pages, AI chat shares and free site-builder roots. Used by
 * websiteValidity (flags `website_invalid`) and by Task 6, which must never
 * match two leads on a platform domain.
 *
 * Add a domain to the group that says how it behaves:
 * - LISTING and AI_SHARE domains: every page on them (and any subdomain) is junk.
 * - HOSTING_ROOT domains: the bare root is junk, but a business's own
 *   subdomain (alubestinteriors.netlify.app) is a real site and stays valid.
 */
import { hostOfUrl } from '@/lib/import/websiteHost'

const LISTING_DOMAINS: readonly string[] = [
  'justdial.com',
  'indiamart.com',
  'sulekha.com',
  'tradeindia.com',
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'linkedin.com',
  'wa.me',
]

const AI_SHARE_DOMAINS: readonly string[] = [
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'gemini.google.com',
]

const HOSTING_ROOT_DOMAINS: readonly string[] = [
  'netlify.app',
  'business.site',
  'wixsite.com',
  'godaddysites.com',
  'blogspot.com',
  'carrd.co',
  'grexa.site',
  'odoo.com',
]

/** Every platform domain, for callers that only need "is this host a platform". */
export const PLATFORM_DOMAINS: readonly string[] = [
  ...LISTING_DOMAINS,
  ...AI_SHARE_DOMAINS,
  ...HOSTING_ROOT_DOMAINS,
]

/** True when the address is a platform page or a bare hosting root, not a business's own site. */
export function isPlatformUrl(url: string): boolean {
  const host = hostOfUrl(url)
  if (host === null) return false
  return (
    isOnDomain(host, LISTING_DOMAINS) ||
    isOnDomain(host, AI_SHARE_DOMAINS) ||
    HOSTING_ROOT_DOMAINS.includes(host)
  )
}

/** The domain itself or any subdomain of it ("m.facebook.com" is on facebook.com). */
function isOnDomain(host: string, domains: readonly string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
}
