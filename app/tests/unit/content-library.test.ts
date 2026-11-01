/**
 * Unit tests for the pure parts of the playbook and objection library: choosing
 * an objection response in a contact's mix, grouping template rows, and filling
 * a template message for one phone point.
 */
import { describe, expect, it } from 'vitest'
import { buildTemplateMessage } from '@/lib/content/buildTemplateMessage'
import { groupTemplates } from '@/lib/content/groupTemplates'
import { pickObjectionResponse } from '@/lib/content/pickObjectionResponse'
import type { CallObjection, CallTemplate } from '@/lib/call/callScreen'
import type { ContentVariant } from '@/lib/language/types'

function variant(id: string, mix: ContentVariant['mix'], body: string, parent: string | null = null): ContentVariant {
  return { id, kind: 'objection_response', mix, script: 'latin', register: 'formal', body, parentVariantId: parent }
}

const english = variant('e1', ['en'], 'English answer')
const teluguMix = variant('t1', ['te', 'en'], 'Telugu answer', 'e1')

function objection(extra: CallObjection['responses'] = []): CallObjection {
  return {
    id: 'o1', text: 'Too expensive', englishId: 'e1',
    responses: [{ variant: english, isDraft: false }, ...extra],
  }
}

describe('pickObjectionResponse', () => {
  it('uses the variant in the contact mix when one exists', () => {
    const picked = pickObjectionResponse(objection([{ variant: teluguMix, isDraft: false }]), ['te', 'en'])
    expect(picked).toMatchObject({ body: 'Telugu answer', needsRewrite: false, isDraft: false })
  })

  it('falls back to English with a rewrite offer when no variant fits', () => {
    const picked = pickObjectionResponse(objection(), ['te', 'hi', 'en'])
    expect(picked).toMatchObject({ body: 'English answer', needsRewrite: true })
  })

  it('needs no rewrite when the contact speaks English', () => {
    expect(pickObjectionResponse(objection(), ['en']).needsRewrite).toBe(false)
  })

  it('treats an empty mix as English instead of throwing', () => {
    expect(pickObjectionResponse(objection(), []).body).toBe('English answer')
  })

  it('marks an unapproved AI draft as a draft', () => {
    const picked = pickObjectionResponse(objection([{ variant: teluguMix, isDraft: true }]), ['te', 'en'])
    expect(picked.isDraft).toBe(true)
  })

  it('offers no rewrite when the objection has no English response', () => {
    const bare: CallObjection = { id: 'o2', text: 'Not now', englishId: null, responses: [] }
    expect(pickObjectionResponse(bare, ['te'])).toMatchObject({ body: '', needsRewrite: false })
  })
})

describe('groupTemplates', () => {
  const rows = [
    { ...variant('a', ['en'], 'Hello {name}'), kind: 'template' as const, title: 'Thanks' },
    { ...variant('a2', ['te'], 'Namaste {name}', 'a'), kind: 'template' as const, title: null },
    { ...variant('b', ['en'], 'Reminder {name}'), kind: 'template' as const, title: 'Demo reminder' },
  ]

  it('groups each English template with its rewrites, sorted by title', () => {
    const groups = groupTemplates(rows)
    expect(groups.map((group) => group.title)).toEqual(['Demo reminder', 'Thanks'])
    expect(groups[1].variants.map((item) => item.id)).toEqual(['a', 'a2'])
  })
})

describe('buildTemplateMessage', () => {
  const template: CallTemplate = {
    id: 'a', title: 'Thanks',
    variants: [{ ...variant('a', ['en'], 'Hello {name} {honorific}, about {company}'), kind: 'template' }],
  }
  const point = { e164: '+919866100001', waStatus: 'unconfirmed' as const }
  const who = { name: 'Ramesh', company: 'Sri Coaching', honorific: 'garu' }

  it('fills the placeholders and builds a wa.me link', () => {
    const message = buildTemplateMessage(template, point, ['te', 'en'], who)
    expect(message?.text).toBe('Hello Ramesh garu, about Sri Coaching')
    expect(message?.link?.url).toContain('wa.me/919866100001')
    expect(message?.link?.url).toContain(encodeURIComponent('Hello Ramesh garu'))
  })

  it('works with an empty mix by using English', () => {
    expect(buildTemplateMessage(template, point, [], who)?.text).toContain('Ramesh')
  })

  it('gives no link for a landline', () => {
    const message = buildTemplateMessage(template, { ...point, waStatus: 'landline' }, ['en'], who)
    expect(message?.link).toBeNull()
  })

  it('returns null when no variant of the template fits', () => {
    const teluguOnly: CallTemplate = { ...template, variants: [{ ...template.variants[0], mix: ['te'] }] }
    expect(buildTemplateMessage(teluguOnly, point, ['hi'], who)).toBeNull()
  })
})
