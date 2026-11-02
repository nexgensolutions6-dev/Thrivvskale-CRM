/**
 * Plain-English labels for contact roles and WhatsApp statuses, shared by the
 * people panel and the contact form. Pure data. Called by components in
 * src/components/lead.
 */
import type { ContactRole, WaStatus } from '@/lib/domain'

export const ROLE_LABELS: Record<ContactRole, string> = {
  owner: 'Owner',
  decision_maker: 'Decision maker',
  manager: 'Manager',
  gatekeeper: 'Gatekeeper',
  other: 'Other',
}

export const WA_LABELS: Record<WaStatus, string> = {
  verified: 'WhatsApp verified',
  unconfirmed: 'WhatsApp not confirmed',
  landline: 'Landline',
  none: 'No WhatsApp',
}
