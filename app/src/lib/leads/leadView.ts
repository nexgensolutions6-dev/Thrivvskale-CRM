/**
 * The shapes of everything the lead workspace shows (LeadView and its parts).
 * Built by loadLead, read by the lead page and the components in
 * src/components/lead. Types only, no logic.
 */
import type { Database } from '@/lib/db/types'
import type { ContactRole, LangCode, Mix, Outcome, Register, Script, WaStatus } from '@/lib/domain'

export type CompanyRow = Database['public']['Tables']['companies']['Row']

export interface LeadContact {
  id: string
  name: string | null
  nameLatin: string | null
  role: ContactRole
  languages: LangCode[]
  mixProfile: string | null
  scriptPref: Script | null
  register: Register | null
  notes: string | null
  createdAt: string
}

export interface LeadPoint {
  id: string
  /** Null for a company line (switchboard, landline) that belongs to no one person. */
  contactId: string | null
  e164: string
  kind: 'business' | 'personal' | 'landline'
  waStatus: WaStatus
}

export interface LeadOpener {
  id: string
  body: string
  mix: Mix
  script: Script
  /** Null when the opener is written for either tone. */
  register: Register | null
  vertical: string | null
  /** Set when the opener was written for one company (a CSV opener); null for a generic one. */
  companyId: string | null
}

export interface LeadTask {
  id: string
  title: string
  type: string
  dueAt: string | null
  doneAt: string | null
}

export interface LeadActivity {
  id: string
  type: string
  body: string | null
  occurredAt: string
}

export interface LeadView {
  company: CompanyRow
  /** company.entry_offer, else the vertical default; null when neither exists. */
  entryOffer: string | null
  entryOfferIsDefault: boolean
  longTermOpportunity: string | null
  contacts: LeadContact[]
  points: LeadPoint[]
  openers: LeadOpener[]
  /** The workspace's default language mix, used when the primary contact has none. */
  workspaceMix: Mix
  tasks: LeadTask[]
  activities: LeadActivity[]
  /** Outcomes of this company's past calls; the score breakdown reads them. */
  callOutcomes: Outcome[]
}
