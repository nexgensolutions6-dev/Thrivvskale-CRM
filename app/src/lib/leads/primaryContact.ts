/**
 * Picks a lead's primary contact, the person whose language mix the whole
 * lead uses: decision maker, then owner, then manager, then other, then
 * gatekeeper; the earliest created wins a tie. Pure. Called by loadLead and
 * the lead page.
 */
import type { ContactRole } from '@/lib/domain'

const ROLE_ORDER: readonly ContactRole[] = ['decision_maker', 'owner', 'manager', 'other', 'gatekeeper']

export function pickPrimaryContact<T extends { role: ContactRole; createdAt: string }>(contacts: T[]): T | null {
  let best: T | null = null
  for (const contact of contacts) {
    if (best === null || isBetter(contact, best)) best = contact
  }
  return best
}

type Ranked = { role: ContactRole; createdAt: string }

function isBetter(candidate: Ranked, current: Ranked): boolean {
  const byRole = ROLE_ORDER.indexOf(candidate.role) - ROLE_ORDER.indexOf(current.role)
  if (byRole !== 0) return byRole < 0
  return candidate.createdAt < current.createdAt
}
