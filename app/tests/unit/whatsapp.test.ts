import { describe, expect, it } from 'vitest'
import { buildWaLink } from '@/lib/whatsapp/link'
import { validateConfirmInput } from '@/lib/whatsapp/validateConfirmInput'

const MOBILE = '+919876543210'

function decodedText(url: string): string | null {
  return new URL(url).searchParams.get('text')
}

describe('buildWaLink', () => {
  it('round-trips Telugu text', () => {
    const link = buildWaLink({ e164: MOBILE, waStatus: 'unconfirmed' }, 'నమస్తే sir')
    expect(link?.copyOnly).toBe(false)
    expect(link?.url.startsWith('https://wa.me/919876543210?text=')).toBe(true)
    expect(decodedText(link!.url)).toBe('నమస్తే sir')
  })

  it('round-trips Hinglish with an emoji', () => {
    const text = 'Namaste ji, aapka website ready hai 🙏'
    const link = buildWaLink({ e164: MOBILE, waStatus: 'verified' }, text)
    expect(decodedText(link!.url)).toBe(text)
  })

  it('returns null for landline and none', () => {
    expect(buildWaLink({ e164: MOBILE, waStatus: 'landline' }, 'hi')).toBeNull()
    expect(buildWaLink({ e164: MOBILE, waStatus: 'none' }, 'hi')).toBeNull()
  })

  it('goes copy-only without text when the encoded URL is over 2000 characters', () => {
    const link = buildWaLink({ e164: MOBILE, waStatus: 'unconfirmed' }, 'a'.repeat(3000))
    expect(link).toEqual({ url: 'https://wa.me/919876543210', copyOnly: true })
  })

  it('stays a normal link at exactly 2000 characters', () => {
    const prefix = 'https://wa.me/919876543210?text='
    const link = buildWaLink({ e164: MOBILE, waStatus: 'unconfirmed' }, 'a'.repeat(2000 - prefix.length))
    expect(link?.url.length).toBe(2000)
    expect(link?.copyOnly).toBe(false)
  })
})

describe('validateConfirmInput', () => {
  const ID = '00000000-0000-4000-8000-000000000000'

  it('accepts a uuid and a boolean', () => {
    expect(() => validateConfirmInput(ID, true)).not.toThrow()
    expect(() => validateConfirmInput(ID, false)).not.toThrow()
  })

  it('rejects a string hasWhatsApp, naming the value', () => {
    expect(() => validateConfirmInput(ID, 'false')).toThrow(/\[confirmWhatsApp\] validate input.*"false"/)
  })

  it('rejects a non-uuid or non-string contactPointId, naming the value', () => {
    expect(() => validateConfirmInput('abc', true)).toThrow(/validate input.*"abc"/)
    expect(() => validateConfirmInput(42, true)).toThrow(/validate input.*42/)
  })
})
