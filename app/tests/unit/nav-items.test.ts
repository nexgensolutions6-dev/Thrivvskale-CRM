import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, isNavActive } from '@/lib/shell/nav-items'

describe('NAV_ITEMS', () => {
  it('lists Today, Call, Leads and More in that order', () => {
    expect(NAV_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ['Today', '/today'],
      ['Call', '/call'],
      ['Leads', '/leads'],
      ['More', '/more'],
    ])
  })
})

describe('isNavActive', () => {
  it.each([
    ['/today', '/today'],
    ['/leads/123', '/leads'],
    ['/more/settings', '/more'],
    ['/more/import', '/more'],
  ])('%s highlights %s', (pathname, href) => {
    expect(isNavActive(pathname, href)).toBe(true)
  })

  it.each([
    ['/leadsx', '/leads'],
    ['/today', '/call'],
    ['/', '/today'],
  ])('%s does not highlight %s', (pathname, href) => {
    expect(isNavActive(pathname, href)).toBe(false)
  })
})
