import { describe, expect, it } from 'vitest'
import { honorificFor, nextMixProfile } from '@/lib/language/mix'
import { fillTemplate, pickVariant, type ContentVariant } from '@/lib/language/variants'

function variant(id: string, over: Partial<ContentVariant> = {}): ContentVariant {
  return { id, kind: 'opener', mix: ['en'], script: 'latin', register: 'formal', body: id, parentVariantId: null, ...over }
}
const want = { mix: ['te', 'hi', 'en'] as ContentVariant['mix'], script: 'latin' as const, register: 'formal' as const }

describe('pickVariant', () => {
  it('returns exact when the mix matches in order', () => {
    const r = pickVariant([variant('a', { mix: ['te', 'en'] }), variant('b', { mix: ['te', 'hi', 'en'] })], want)
    expect(r?.variant.id).toBe('b')
    expect(r?.match).toBe('exact')
  })
  it('does not treat a different order as exact', () => {
    const r = pickVariant([variant('a', { mix: ['hi', 'te', 'en'] })], want)
    expect(r).toBeNull()
  })
  it('returns primary when only the first language matches', () => {
    expect(pickVariant([variant('a', { mix: ['te', 'en'] })], want)?.match).toBe('primary')
  })
  it('falls back to english-only', () => {
    expect(pickVariant([variant('a', { mix: ['kn', 'en'] }), variant('b')], want)).toMatchObject({ match: 'english', variant: { id: 'b' } })
  })
  it('returns null when nothing matches or list is empty', () => {
    expect(pickVariant([variant('a', { mix: ['kn', 'en'] })], want)).toBeNull()
    expect(pickVariant([], want)).toBeNull()
  })
  it('prefers same script, then same register, at the same level', () => {
    const mix: ContentVariant['mix'] = ['te', 'hi', 'en']
    const vs = [variant('a', { mix, script: 'native' }), variant('b', { mix, register: 'casual' }), variant('c', { mix })]
    expect(pickVariant(vs, want)?.variant.id).toBe('c')
    expect(pickVariant(vs.slice(0, 2), want)?.variant.id).toBe('b')
    expect(pickVariant(vs.slice(0, 1), want)?.variant.id).toBe('a')
  })
  it('breaks full ties by input order', () => {
    expect(pickVariant([variant('x'), variant('y')], want)?.variant.id).toBe('x')
  })
  it('prefers a better level over a better script', () => {
    const r = pickVariant([variant('a', { mix: ['te', 'en'] }), variant('b', { script: 'native' })], want)
    expect(r?.variant.id).toBe('a')
  })
  it('throws a named error for an empty wanted mix', () => {
    expect(() => pickVariant([], { ...want, mix: [] })).toThrow(/\[language\/pickVariant\]/)
  })
})

describe('fillTemplate', () => {
  it('fills known placeholders and keeps unknown ones', () => {
    expect(fillTemplate('Hi {name}{honorific}, {company} {unknown}', { name: 'Ravi', honorific: ' garu', company: 'Acme' })).toBe('Hi Ravi garu, Acme {unknown}')
  })
  it('leaves a placeholder when its value is missing', () => {
    expect(fillTemplate('Hi {name} of {company}', { name: 'Ravi' })).toBe('Hi Ravi of {company}')
  })
  it('replaces every occurrence', () => {
    expect(fillTemplate('{name} {name}', { name: 'A' })).toBe('A A')
  })
})

describe('honorificFor', () => {
  it('uses formal forms per primary language', () => {
    expect(honorificFor('te', 'formal')).toBe('garu')
    expect(honorificFor('hi', 'formal')).toBe('ji')
    expect(honorificFor('kn', 'formal')).toBe('avare')
    expect(honorificFor('en', 'formal')).toBe('sir/madam')
  })
  it('uses sir for casual and for other formal languages', () => {
    expect(honorificFor('te', 'casual')).toBe('sir')
    expect(honorificFor('ta', 'casual')).toBe('sir')
    expect(honorificFor('ta', 'formal')).toBe('sir')
  })
})

describe('nextMixProfile', () => {
  it('picks the most frequent of the last 3', () => {
    expect(nextMixProfile(['te', 'hi', 'en'], [['kn', 'en'], ['kn', 'en'], ['te', 'en']])).toEqual(['kn', 'en'])
  })
  it('gives ties to the most recent', () => {
    expect(nextMixProfile(['en'], [['te'], ['hi'], ['kn']])).toEqual(['kn'])
  })
  it('ignores entries older than the last 3', () => {
    expect(nextMixProfile(['en'], [['te'], ['te'], ['hi'], ['kn'], ['kn']])).toEqual(['kn'])
  })
  it('keeps current when nothing was spoken', () => {
    expect(nextMixProfile(['te', 'en'], [])).toEqual(['te', 'en'])
  })
  it('compares mixes as ordered lists', () => {
    expect(nextMixProfile(['en'], [['te', 'en'], ['en', 'te'], ['en', 'te']])).toEqual(['en', 'te'])
  })
})
