import { describe, expect, it } from 'vitest'
import { tierForVertical } from '@/lib/domain'

describe('tierForVertical', () => {
  it('classifies Interiors & Modular as core', () => {
    expect(tierForVertical('Interiors & Modular')).toBe('core')
  })

  it('classifies Real Estate & Construction as exploratory', () => {
    expect(tierForVertical('Real Estate & Construction')).toBe('exploratory')
  })

  it('classifies Automobile & Driving Schools as exploratory', () => {
    expect(tierForVertical('Automobile & Driving Schools')).toBe('exploratory')
  })

  it('classifies an unknown vertical as exploratory', () => {
    expect(tierForVertical('Underwater Basket Weaving')).toBe('exploratory')
  })
})
