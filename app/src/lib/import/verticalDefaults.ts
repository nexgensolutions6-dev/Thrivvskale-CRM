/**
 * The default entry offer of each vertical: the offer most of its leads
 * share. Called by importLeads. A company on its vertical's default stores
 * no entry_offer of its own (null), so only the exceptions are stored.
 * A default saved by an earlier import is kept, so companies stored as null
 * never change meaning.
 */
import type { ImportDb } from '@/lib/import/importDb'
import type { MappedLead } from '@/lib/import/mapLeadRow'
import { stepError } from '@/lib/step-error'

const MODULE = 'verticalDefaults'

/** vertical -> its entry offer */
export type DefaultOffers = Map<string, string>

/** The most frequent offer per vertical in the file; a tie goes to the first seen. */
export function mostFrequentOffers(leads: MappedLead[]): DefaultOffers {
  const counts = new Map<string, Map<string, number>>()
  for (const { company } of leads) {
    if (company.vertical === '' || company.entryOffer === null) continue
    const offers = counts.get(company.vertical) ?? new Map<string, number>()
    offers.set(company.entryOffer, (offers.get(company.entryOffer) ?? 0) + 1)
    counts.set(company.vertical, offers)
  }

  const winners: DefaultOffers = new Map()
  for (const [vertical, offers] of counts) {
    const [topOffer] = [...offers.entries()].reduce((best, next) => (next[1] > best[1] ? next : best))
    winners.set(vertical, topOffer)
  }
  return winners
}

/** Saves defaults for verticals that have none yet; returns every default the workspace now has. */
export async function saveVerticalDefaults(
  db: ImportDb,
  workspaceId: string,
  leads: MappedLead[],
): Promise<DefaultOffers> {
  const rows = [...mostFrequentOffers(leads)].map(([vertical, entry_offer]) => ({
    workspace_id: workspaceId,
    vertical,
    entry_offer,
  }))
  if (rows.length > 0) {
    const saved = await db
      .from('vertical_defaults')
      .upsert(rows, { onConflict: 'workspace_id,vertical', ignoreDuplicates: true })
    if (saved.error) throw stepError(MODULE, 'save vertical defaults', saved.error)
  }

  const all = await db.from('vertical_defaults').select('vertical, entry_offer').eq('workspace_id', workspaceId)
  if (all.error) throw stepError(MODULE, 'read vertical defaults', all.error)

  const offers: DefaultOffers = new Map()
  for (const row of all.data) if (row.entry_offer !== null) offers.set(row.vertical, row.entry_offer)
  return offers
}
