import { describe, expect, it } from 'vitest'
import type { LeadContact, LeadView } from '@/lib/leads/leadView'
import { buildOpenerChoices } from '@/lib/leads/openerChoices'

function contact(extra: Partial<LeadContact>): LeadContact {
  return {
    id: 'c1', name: null, nameLatin: null, role: 'other', languages: [], mixProfile: null,
    scriptPref: null, register: null, notes: null, createdAt: '2026-01-01T00:00:00Z', ...extra,
  }
}

function view(extra: Partial<LeadView>): LeadView {
  return {
    company: { name: 'Divyank Industries' },
    entryOffer: null, entryOfferIsDefault: false, longTermOpportunity: null,
    contacts: [], points: [],
    openers: [
      { id: 'o-en', body: 'Hello {name} from {company}', mix: ['en'], script: 'latin', register: null, vertical: null },
      { id: 'o-te', body: 'Namaskaram {name} {honorific}', mix: ['te', 'en'], script: 'latin', register: null, vertical: null },
    ],
    workspaceMix: ['te', 'hi', 'en'], tasks: [], activities: [], callOutcomes: [],
    ...extra,
  } as LeadView
}

describe('buildOpenerChoices', () => {
  it('uses the primary contact mix, best opener first, with the name filled in', () => {
    const choices = buildOpenerChoices(view({
      contacts: [contact({ role: 'decision_maker', name: 'రమేష్', nameLatin: 'Ramesh', mixProfile: 'te+en' })],
    }))
    expect(choices.mixLabel).toBe('te+en')
    expect(choices.openers.map((o) => [o.id, o.matchLabel])).toEqual([['o-te', 'exact mix'], ['o-en', 'English']])
    expect(choices.openers[0].text).toBe('Namaskaram Ramesh garu')
    expect(choices.openers[1].text).toBe('Hello Ramesh from Divyank Industries')
  })

  it('falls back to the workspace default mix when there is no contact', () => {
    const choices = buildOpenerChoices(view({}))
    expect(choices.mixLabel).toBe('te+hi+en')
    expect(choices.openers.map((o) => o.id)).toEqual(['o-te', 'o-en'])
  })

  it('names each number by its owner', () => {
    const choices = buildOpenerChoices(view({
      contacts: [contact({ id: 'c1', nameLatin: 'Ramesh' })],
      points: [
        { id: 'p1', contactId: 'c1', e164: '+919866139900', kind: 'business', waStatus: 'unconfirmed' },
        { id: 'p2', contactId: null, e164: '+914023456789', kind: 'landline', waStatus: 'landline' },
      ],
    }))
    expect(choices.points.map((p) => p.owner)).toEqual(['Ramesh', 'company line'])
  })
})
