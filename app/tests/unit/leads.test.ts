/**
 * Unit tests for the pure lead helpers in src/lib/leads and src/lib/site-check:
 * entry-offer fallback, score breakdown, language mix, primary contact, maps
 * link, list parameters, intent-signal removal and form-input validation.
 */
import { describe, expect, it } from 'vitest'
import { dynamicScore } from '@/lib/queue/dynamicScore'
import type { ContactRole, Outcome } from '@/lib/domain'
import { contactMix, leadMix, parseMixText } from '@/lib/leads/contactMix'
import { resolveEntryOffer } from '@/lib/leads/entryOffer'
import { isUuid } from '@/lib/leads/isUuid'
import { parseListParams } from '@/lib/leads/listParams'
import { mapsUrl } from '@/lib/leads/mapsUrl'
import { pickPrimaryContact } from '@/lib/leads/primaryContact'
import { scoreBreakdown } from '@/lib/leads/scoreBreakdown'
import { validateContactInput } from '@/lib/leads/validateContactInput'
import { validateNoteInput } from '@/lib/leads/validateNoteInput'
import { nextIntentSignal } from '@/lib/site-check/nextIntentSignal'
import { SITE_FAILED, SITE_LOADS } from '@/lib/site-check/websiteStatus'

const UUID = '0b0f0d3e-7a1c-4a52-9a56-0c6b6f2a1e11'

describe('resolveEntryOffer', () => {
  it('uses the company offer when it has one', () => {
    expect(resolveEntryOffer('Own offer', 'Default offer')).toBe('Own offer')
  })
  it('falls back to the vertical default when the company offer is null or blank', () => {
    expect(resolveEntryOffer(null, 'Default offer')).toBe('Default offer')
    expect(resolveEntryOffer('   ', 'Default offer')).toBe('Default offer')
  })
  it('is null when neither exists', () => {
    expect(resolveEntryOffer(null, null)).toBeNull()
  })
})

describe('scoreBreakdown', () => {
  const cases: Array<[string, number, boolean, Outcome[]]> = [
    ['base only', 65, false, []],
    ['intent', 65, true, []],
    ['interested and meeting', 50, true, ['interested', 'meeting_booked']],
    ['capped penalties', 50, false, ['no_answer', 'no_answer', 'no_answer', 'no_answer', 'no_answer', 'no_answer', 'gatekeeper', 'gatekeeper', 'gatekeeper', 'gatekeeper']],
  ]
  it.each(cases)('total equals dynamicScore: %s', (_label, base, intent, outcomes) => {
    expect(scoreBreakdown(base, { intent, outcomes }).total).toBe(dynamicScore(base, { intent, outcomes }))
  })

  it('lists base first and only the lines that apply', () => {
    const { lines } = scoreBreakdown(65, { intent: true, outcomes: ['no_answer', 'no_answer'] })
    expect(lines.map((line) => line.label)).toEqual(['Base score', 'Buying intent signal', 'No answer x2'])
    expect(lines.map((line) => line.points)).toEqual([65, 10, -4])
  })

  it('shows capped penalties at the cap', () => {
    const { lines } = scoreBreakdown(0, { intent: false, outcomes: Array<Outcome>(10).fill('no_answer') })
    expect(lines.find((line) => line.label.startsWith('No answer'))?.points).toBe(-10)
  })
})

describe('language mix helpers', () => {
  it('parses the text form and tolerates spaces and commas', () => {
    expect(parseMixText('te+hi+en')).toEqual(['te', 'hi', 'en'])
    expect(parseMixText(' te , en ')).toEqual(['te', 'en'])
    expect(parseMixText('')).toEqual([])
  })
  it('rejects an unknown language and too many languages, naming the bad value', () => {
    expect(() => parseMixText('te+xx')).toThrow(/\[contactMix\].*"xx"/)
    expect(() => parseMixText('te+hi+kn+ta+ml+mr+ur+en+te')).toThrow(/too many/)
  })
  it('reads a contact mix from mix_profile first, then languages, else null', () => {
    expect(contactMix({ mixProfile: 'hi+en', languages: ['te'] })).toEqual(['hi', 'en'])
    expect(contactMix({ mixProfile: null, languages: ['te', 'en'] })).toEqual(['te', 'en'])
    expect(contactMix({ mixProfile: '', languages: [] })).toBeNull()
  })
  it('ignores a corrupt mix_profile and falls through to languages', () => {
    expect(contactMix({ mixProfile: 'zz', languages: ['kn'] })).toEqual(['kn'])
  })
  it('leadMix uses the contact mix, else the workspace default, else English', () => {
    expect(leadMix({ mixProfile: 'hi', languages: [] }, ['te', 'en'])).toEqual(['hi'])
    expect(leadMix({ mixProfile: null, languages: [] }, ['te', 'en'])).toEqual(['te', 'en'])
    expect(leadMix(null, ['te', 'en'])).toEqual(['te', 'en'])
    expect(leadMix(null, [])).toEqual(['en'])
  })
})

describe('pickPrimaryContact', () => {
  const c = (id: string, role: ContactRole, createdAt: string) => ({ id, role, createdAt })
  it('prefers decision maker, then owner, then manager, then other, then gatekeeper', () => {
    const list = [c('g', 'gatekeeper', '2026-01-01'), c('o', 'other', '2026-01-02'), c('d', 'decision_maker', '2026-01-03')]
    expect(pickPrimaryContact(list)?.id).toBe('d')
    expect(pickPrimaryContact(list.slice(0, 2))?.id).toBe('o')
  })
  it('breaks ties by earliest created and returns null for no contacts', () => {
    expect(pickPrimaryContact([c('b', 'owner', '2026-02-01'), c('a', 'owner', '2026-01-01')])?.id).toBe('a')
    expect(pickPrimaryContact([])).toBeNull()
  })
})

describe('mapsUrl', () => {
  it('builds a Google Maps search link from name, area and city', () => {
    const url = new URL(mapsUrl({ name: 'Divyank Industries', area: 'SVCIE Balanagar', city: 'Hyderabad' }))
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/')
    expect(url.searchParams.get('api')).toBe('1')
    expect(url.searchParams.get('query')).toBe('Divyank Industries, SVCIE Balanagar, Hyderabad')
  })
  it('skips missing parts', () => {
    const url = new URL(mapsUrl({ name: 'A & B', area: null, city: '' }))
    expect(url.searchParams.get('query')).toBe('A & B')
  })
})

describe('parseListParams', () => {
  it('reads the filters and trims them', () => {
    expect(parseListParams({ q: ' ramesh ', vertical: 'Clinics', area: 'Uppal', priority: 'A', status: 'No website', page: '3' })).toEqual({
      q: 'ramesh', vertical: 'Clinics', area: 'Uppal', priority: 'A', websiteStatus: 'No website', page: 3,
    })
  })
  it('uses safe defaults for missing, repeated or invalid values', () => {
    expect(parseListParams({})).toEqual({ q: '', vertical: '', area: '', priority: '', websiteStatus: '', page: 1 })
    expect(parseListParams({ priority: 'Z', page: '-4' }).priority).toBe('')
    expect(parseListParams({ priority: 'Z', page: '-4' }).page).toBe(1)
    expect(parseListParams({ page: 'abc' }).page).toBe(1)
    expect(parseListParams({ q: ['a', 'b'] }).q).toBe('a')
  })
  it('caps the query length', () => {
    expect(parseListParams({ q: 'x'.repeat(500) }).q).toHaveLength(100)
  })
})

describe('nextIntentSignal', () => {
  const BROKEN = 'Broken/wrong website live on Google profile right now'
  it('removes the broken-website signal when the site goes from failed to loading', () => {
    expect(nextIntentSignal(BROKEN, SITE_FAILED, SITE_LOADS)).toBeNull()
  })
  it('keeps it when the site did not change from failed to loading', () => {
    expect(nextIntentSignal(BROKEN, SITE_FAILED, SITE_FAILED)).toBe(BROKEN)
    expect(nextIntentSignal(BROKEN, SITE_LOADS, SITE_LOADS)).toBe(BROKEN)
    expect(nextIntentSignal(BROKEN, 'Not checked yet', SITE_LOADS)).toBe(BROKEN)
  })
  it('keeps every other signal and a null signal', () => {
    const hiring = 'Hiring for manual front-office/telecalling work'
    expect(nextIntentSignal(hiring, SITE_FAILED, SITE_LOADS)).toBe(hiring)
    expect(nextIntentSignal(null, SITE_FAILED, SITE_LOADS)).toBeNull()
  })
})

describe('isUuid', () => {
  it('accepts uuids and rejects everything else', () => {
    expect(isUuid(UUID)).toBe(true)
    for (const bad of ['', 'abc', UUID + 'x', null, undefined, 5, {}]) expect(isUuid(bad)).toBe(false)
  })
})

describe('validateContactInput', () => {
  const base = { companyId: UUID, name: ' Ramesh ', nameLatin: 'ramesh', role: 'decision_maker', languages: 'te+en', phone: '98661 39900' }

  it('trims strings, normalises the phone and parses the mix', () => {
    const valid = validateContactInput(base)
    expect(valid).toMatchObject({
      companyId: UUID, contactId: null, name: 'Ramesh', nameLatin: 'ramesh', role: 'decision_maker', mix: ['te', 'en'],
      notes: null,
    })
    expect(valid.phone).toEqual({ e164: '+919866139900', kind: 'mobile' })
  })

  it('defaults role to other and treats blank optional fields as null', () => {
    const valid = validateContactInput({ companyId: UUID, name: 'Front desk', nameLatin: '  ', phone: '', languages: '', notes: ' ' })
    expect(valid).toMatchObject({ role: 'other', nameLatin: null, phone: null, mix: [], notes: null })
  })

  it('accepts an update with a contactId', () => {
    expect(validateContactInput({ ...base, contactId: UUID }).contactId).toBe(UUID)
  })

  it.each([
    ['not an object', 'text', /input must be an object/],
    ['null', null, /input must be an object/],
    ['non-uuid companyId', { ...base, companyId: 'abc' }, /companyId must be a uuid/],
    ['non-uuid contactId', { ...base, contactId: 'abc' }, /contactId must be a uuid/],
    ['bad role', { ...base, role: 'boss' }, /role must be one of/],
    ['non-string role', { ...base, role: 5 }, /role must be one of/],
    ['bad phone', { ...base, phone: '12345' }, /phone .* is not an Indian phone number/],
    ['non-string phone', { ...base, phone: 5 }, /phone must be a string/],
    ['long name', { ...base, name: 'x'.repeat(121) }, /name is too long/],
    ['long name_latin', { ...base, nameLatin: 'x'.repeat(121) }, /nameLatin is too long/],
    ['long notes', { ...base, notes: 'x'.repeat(2001) }, /notes is too long/],
    ['NUL character', { ...base, name: 'Ra\u0000mesh' }, /name contains a control character/],
    ['bad language', { ...base, languages: 'te+xx' }, /languages/],
    ['nothing to identify the person', { companyId: UUID, name: '', nameLatin: '', phone: '' }, /name, nameLatin or phone/],
  ])('rejects %s', (_label, input, message) => {
    expect(() => validateContactInput(input)).toThrow(message)
  })

  it('names the module and step', () => {
    expect(() => validateContactInput({ ...base, role: 'boss' })).toThrow(/^\[validateContactInput\] validate role failed/)
  })
})

describe('validateNoteInput', () => {
  it('trims the body', () => {
    expect(validateNoteInput(UUID, '  Called the owner  ')).toEqual({ companyId: UUID, body: 'Called the owner' })
  })
  it.each([
    ['non-uuid company', 'abc', 'hello', /companyId must be a uuid/],
    ['blank body', UUID, '   ', /body is empty/],
    ['non-string body', UUID, 5, /body must be a string/],
    ['huge body', UUID, 'x'.repeat(2001), /body is too long/],
  ])('rejects %s', (_label, companyId, body, message) => {
    expect(() => validateNoteInput(companyId, body)).toThrow(message)
  })
})
