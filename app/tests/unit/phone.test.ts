import { describe, expect, it } from 'vitest'
import { normalizePhone } from '@/lib/phone'

const MOBILE = { e164: '+919866139900', kind: 'mobile' } as const

describe('normalizePhone', () => {
  describe('mobile numbers', () => {
    it.each([
      ['canonical E.164', '+919866139900'],
      ['leading trunk 0', '09866139900'],
      ['national digits with a space', '98661 39900'],
      ['spaces and a hyphen after +91', '+91 98661-39900'],
      ['leading 91 without +', '919866139900'],
      ['bare 10 digits', '9866139900'],
      ['trailing space (real data)', '+91 98661 39900 '],
      ['leading and trailing whitespace', '  +91 98661 39900\t'],
      ['hyphens only', '98661-39900'],
      ['parentheses around the country code', '(+91) 98661 39900'],
    ])('normalises %s to the same E.164 mobile', (_label, raw) => {
      expect(normalizePhone(raw)).toEqual(MOBILE)
    })

    it('treats every first digit 6-9 as mobile', () => {
      for (const first of ['6', '7', '8', '9']) {
        expect(normalizePhone(`+91${first}000000000`)).toEqual({
          e164: `+91${first}000000000`,
          kind: 'mobile',
        })
      }
    })

    it('does not strip a 91 that belongs to a 10-digit national number', () => {
      expect(normalizePhone('9198765432')).toEqual({
        e164: '+919198765432',
        kind: 'mobile',
      })
    })
  })

  describe('landline numbers', () => {
    it('classifies a Hyderabad 40 number as landline', () => {
      expect(normalizePhone('+914023456789')).toEqual({
        e164: '+914023456789',
        kind: 'landline',
      })
    })

    it('normalises landline formatting variants', () => {
      expect(normalizePhone('040 2345 6789')).toEqual({
        e164: '+914023456789',
        kind: 'landline',
      })
      expect(normalizePhone('91-40-23456789')).toEqual({
        e164: '+914023456789',
        kind: 'landline',
      })
    })

    it('treats every first digit 2-5 as landline', () => {
      for (const first of ['2', '3', '4', '5']) {
        expect(normalizePhone(`+91${first}000000000`)).toEqual({
          e164: `+91${first}000000000`,
          kind: 'landline',
        })
      }
    })
  })

  describe('rejected input', () => {
    it.each([
      ['too short', '12345'],
      ['empty string', ''],
      ['whitespace only', '   '],
      ['letters only', 'abc'],
      ['WhatsApp URL (real data)', 'https://wa.me/message/HYR3Z3NYD6YUF1'],
      ['URL with digits in it', 'https://wa.me/919866139900'],
      ['too short with +91 (real data)', '+91 99999'],
      ['too long', '+91 98661 399000'],
      ['digits with an extension label', '98661 39900 ext 5'],
      ['letters mixed into the digits', '98661abc39900'],
      ['two numbers in one cell', '9866139900 / 9866139901'],
      ['national number starting 1', '+911866139900'],
      ['national number starting 0', '+910866139900'],
      ['non-Indian country code', '+44 7911 123456'],
      ['US number', '+1 415 555 2671'],
      ['plus with a bare 10-digit number', '+9866139900'],
      ['plus in the middle', '98661+39900'],
      ['11 digits not starting 0', '19866139900'],
      ['13 digits with a leading 0 before 91', '0919866139900'],
    ])('returns null for %s', (_label, raw) => {
      expect(normalizePhone(raw)).toBeNull()
    })

    it('never returns a partial number for a URL', () => {
      expect(normalizePhone('https://wa.me/message/HYR3Z3NYD6YUF1')).toBeNull()
    })
  })
})
