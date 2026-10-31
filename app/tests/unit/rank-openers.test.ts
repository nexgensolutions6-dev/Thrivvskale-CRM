import { describe, expect, it } from 'vitest'
import type { LeadOpener } from '@/lib/leads/leadView'
import { rankOpeners } from '@/lib/leads/rankOpeners'

function opener(id: string, mix: LeadOpener['mix'], extra: Partial<LeadOpener> = {}): LeadOpener {
  return { id, body: id, mix, script: 'latin', register: null, vertical: null, ...extra }
}
const want = { mix: ['te', 'en'] as const, script: 'latin' as const, register: 'casual' as const }

describe('rankOpeners', () => {
  it('puts the exact mix first, then the same primary language, then English', () => {
    const list = [opener('en', ['en']), opener('te', ['te']), opener('te+en', ['te', 'en']), opener('hi', ['hi'])]
    const ranked = rankOpeners(list, { ...want, mix: ['te', 'en'] })
    expect(ranked.map((r) => [r.opener.id, r.match])).toEqual([
      ['te+en', 'exact'],
      ['te', 'primary'],
      ['en', 'english'],
    ])
  })

  it('prefers the wanted script and register between equal matches', () => {
    const list = [
      opener('formal', ['te'], { register: 'formal' }),
      opener('native', ['te'], { script: 'native' }),
      opener('best', ['te'], { register: 'casual' }),
    ]
    expect(rankOpeners(list, { ...want, mix: ['te'] }).map((r) => r.opener.id)).toEqual(['best', 'formal', 'native'])
  })

  it('returns an empty list for no openers', () => {
    expect(rankOpeners([], { ...want, mix: ['en'] })).toEqual([])
  })
})
