import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { tierForVertical } from '@/lib/domain'
import { mapLeadRow } from '@/lib/import/mapLeadRow'
import { parseLeadsCsv } from '@/lib/import/parseLeadsCsv'
import { isPlatformUrl } from '@/lib/import/platformDomains'
import { splitTags } from '@/lib/import/tags'
import { hostOfUrl } from '@/lib/import/websiteHost'

// 24 real rows from the user's file (with its BOM) plus one synthetic landline row.
const SAMPLE_CSV = readFileSync(new URL('../fixtures/leads-sample.csv', import.meta.url), 'utf8')
const SAMPLE_ROWS = parseLeadsCsv(SAMPLE_CSV)

const DIVYANK = 'Divyank Industries (Water Purification)'
const ABHINAV = 'Abhinav Eye Care Centers'
const ALUBEST = 'AluBest Interiors (Aluminium Interiors)'
const DR_SATISH = 'Dr. Satish Erra Homeopathy Clinics'
const VISION_VVK = 'Vision VVK Farms & Resorts'
const SYNTHETIC_LANDLINE = 'Synthetic Landline Clinic (test row)'

function sampleRow(company: string): Record<string, string> {
  const row = SAMPLE_ROWS.find((candidate) => candidate['Company Name'] === company)
  if (!row) throw new Error(`leads-sample.csv has no row for "${company}"`)
  return row
}

const mapSample = (company: string) => mapLeadRow(sampleRow(company))

/** A real row (Divyank) with some cells replaced, for cases the sample file lacks. */
function rowWith(overrides: Record<string, string>): Record<string, string> {
  return { ...sampleRow(DIVYANK), ...overrides }
}

describe('parseLeadsCsv', () => {
  it('reads every row of the sample file, header first column intact', () => {
    expect(SAMPLE_ROWS).toHaveLength(25)
    expect(Object.keys(SAMPLE_ROWS[0])[0]).toBe('Company Name')
  })

  it('returns the same first header with or without a BOM (Review Focus 1)', () => {
    const csv = 'Company Name,Phone\nAcme,+919866139900\n'

    const withBom = parseLeadsCsv('﻿' + csv)

    expect(Object.keys(withBom[0])[0]).toBe('Company Name')
    expect(withBom).toEqual(parseLeadsCsv(csv))
    expect(withBom[0]['Company Name']).toBe('Acme')
  })

  it('keeps a quoted comma inside one value (Review Focus 1)', () => {
    const rows = parseLeadsCsv('Company Name,Industry\nAcme,"Clinics, Diagnostics & Pharmacies"\n')

    expect(rows).toEqual([{ 'Company Name': 'Acme', Industry: 'Clinics, Diagnostics & Pharmacies' }])
  })

  it('keeps a newline inside quotes in one value (Review Focus 1)', () => {
    const rows = parseLeadsCsv('Company Name,Problem\nAcme,"line one\nline two"\nBeta,plain\n')

    expect(rows).toHaveLength(2)
    expect(rows[0].Problem).toBe('line one\nline two')
  })

  it('skips empty lines', () => {
    expect(parseLeadsCsv('Company Name\nAcme\n\nBeta\n\n')).toHaveLength(2)
  })

  it('names the module and step when a quote is never closed', () => {
    expect(() => parseLeadsCsv('Company Name,Problem\nAcme,"never closed\n')).toThrow(
      /^\[parseLeadsCsv\] read CSV failed: /,
    )
  })
})

describe('mapLeadRow: the Divyank row', () => {
  it('maps the headline company fields', () => {
    const { company } = mapSample(DIVYANK)

    expect(company).toMatchObject({
      name: 'Divyank Industries (Water Purification)',
      vertical: 'Manufacturing & Furniture',
      tier: 'core',
      priority: 'A',
      baseScore: 65,
    })
  })

  it('maps every other company column to its field', () => {
    const { company } = mapSample(DIVYANK)

    expect(company).toEqual({
      name: 'Divyank Industries (Water Purification)',
      vertical: 'Manufacturing & Furniture',
      tier: 'core',
      area: 'SVCIE Balanagar',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      websiteUrl: 'https://divyankindustries.com',
      websiteStatus: 'Own site - failed to load in check',
      websiteInvalid: false,
      googleRating: 4.4,
      googleReviews: 54,
      source: 'Apna job post (hiring signal)',
      priority: 'A',
      baseScore: 65,
      intentSignal: 'Hiring for manual front-office/telecalling work',
      problemEvidence: expect.stringContaining('HIRING 2 telecallers on Apna'),
      entryOffer: expect.stringContaining('Product-catalogue website'),
      longTermOpportunity: expect.stringContaining('Manufacturing ERP'),
      stage: 'New',
    })
  })

  it('maps the phone to one unconfirmed business point', () => {
    expect(mapSample(DIVYANK).points).toEqual([
      { e164: '+919866139900', kind: 'business', waStatus: 'unconfirmed' },
    ])
  })

  it('splits the Tags column on semicolons', () => {
    expect(mapSample(DIVYANK).tags).toEqual(['Manufacturing & Furniture', 'Priority A', 'High intent'])
  })

  it('takes the opener from Call Opener and has a number to call', () => {
    const lead = mapSample(DIVYANK)

    expect(lead.opener).toMatch(/^Saw you are hiring telecaller/)
    expect(lead.needsNumber).toBe(false)
    expect(lead.unparsedWhatsapp).toBeNull()
  })

  it('ignores the Description column', () => {
    const lead = mapLeadRow(rowWith({ Description: 'DESCRIPTION-MUST-NOT-APPEAR' }))

    expect(JSON.stringify(lead)).not.toContain('DESCRIPTION-MUST-NOT-APPEAR')
  })
})

describe('mapLeadRow: country', () => {
  it('reads the Country column', () => {
    expect(mapSample(DIVYANK).company.country).toBe('India')
    expect(mapLeadRow(rowWith({ Country: 'Nepal' })).company.country).toBe('Nepal')
  })

  it('defaults to India when the Country cell or column is empty', () => {
    expect(mapLeadRow(rowWith({ Country: '' })).company.country).toBe('India')
    const withoutColumn = rowWith({})
    delete withoutColumn.Country
    expect(mapLeadRow(withoutColumn).company.country).toBe('India')
  })
})

describe('mapLeadRow: phone points and WhatsApp status', () => {
  it('gives a separate WhatsApp number a verified point and leaves the phone unconfirmed (Abhinav)', () => {
    const { points } = mapSample(ABHINAV)

    expect(points).toEqual([
      { e164: '+919154755802', kind: 'business', waStatus: 'unconfirmed' },
      { e164: '+918989545454', kind: 'business', waStatus: 'verified' },
    ])
  })

  it('makes one verified point when the WhatsApp number equals the phone (AluBest)', () => {
    expect(mapSample(ALUBEST).points).toEqual([
      { e164: '+919908101082', kind: 'business', waStatus: 'verified' },
    ])
  })

  it('flags a lead with no phone as needing a number, with no points (Dr. Satish)', () => {
    const lead = mapSample(DR_SATISH)

    expect(lead.needsNumber).toBe(true)
    expect(lead.points).toEqual([])
  })

  it('treats a row with the Phone column missing altogether as no number', () => {
    const row = rowWith({ 'WhatsApp Status': 'No number yet' })
    delete row.Phone

    const lead = mapLeadRow(row)

    expect(lead.needsNumber).toBe(true)
    expect(lead.points).toEqual([])
  })

  it('maps the synthetic landline to a landline point with no WhatsApp', () => {
    expect(mapSample(SYNTHETIC_LANDLINE).points).toEqual([
      { e164: '+914023456789', kind: 'landline', waStatus: 'landline' },
    ])
  })

  it('trusts the CSV status over the number format: a mobile-format number marked Landline (real row 61)', () => {
    const lead = mapLeadRow(
      rowWith({
        'Company Name': 'The Momly Realtors',
        Phone: '+918074496997',
        'WhatsApp Status': 'Landline',
      }),
    )

    expect(lead.points).toEqual([{ e164: '+918074496997', kind: 'landline', waStatus: 'landline' }])
  })

  it.each([
    ['Not verified', 'unconfirmed'],
    ['Verified', 'verified'],
    ['Landline', 'landline'],
    ['No number yet', 'none'],
  ])('maps WhatsApp Status "%s" to waStatus "%s"', (csvStatus, waStatus) => {
    const lead = mapLeadRow(rowWith({ 'WhatsApp Status': csvStatus }))

    expect(lead.points[0].waStatus).toBe(waStatus)
  })

  it('names the module, the company and the bad value for an unknown WhatsApp Status', () => {
    expect(() => mapLeadRow(rowWith({ 'WhatsApp Status': 'Maybe' }))).toThrow(
      /\[mapLeadRow\] map row "Divyank Industries \(Water Purification\)" failed: .*WhatsApp Status.*"Maybe"/,
    )
  })

  it('names the module, the company and the cell when the Phone is not a phone number', () => {
    expect(() => mapLeadRow(rowWith({ Phone: 'call after 5pm' }))).toThrow(
      /\[mapLeadRow\] map row "Divyank Industries \(Water Purification\)" failed: .*Phone.*"call after 5pm"/,
    )
  })
})

describe('mapLeadRow: a WhatsApp cell that is not a phone number', () => {
  // Real row "We Furnish": the verified WhatsApp cell holds a wa.me message link.
  const weFurnish = rowWith({
    'Company Name': 'We Furnish (Furniture Wholesale)',
    Phone: '+918801842162',
    'WhatsApp (verified)': 'https://wa.me/message/HYR3Z3NYD6YUF1',
    'WhatsApp Status': 'Verified',
  })

  it('keeps the raw cell in unparsedWhatsapp and out of points', () => {
    const lead = mapLeadRow(weFurnish)

    expect(lead.unparsedWhatsapp).toBe('https://wa.me/message/HYR3Z3NYD6YUF1')
    expect(lead.points).toEqual([{ e164: '+918801842162', kind: 'business', waStatus: 'unconfirmed' }])
    expect(lead.needsNumber).toBe(false)
  })

  it('still applies Verified to the phone when the WhatsApp cell is empty', () => {
    const lead = mapLeadRow({ ...weFurnish, 'WhatsApp (verified)': '' })

    expect(lead.unparsedWhatsapp).toBeNull()
    expect(lead.points).toEqual([{ e164: '+918801842162', kind: 'business', waStatus: 'verified' }])
  })

  it('leaves unparsedWhatsapp null for an empty cell and for a real number', () => {
    expect(mapSample(DIVYANK).unparsedWhatsapp).toBeNull()
    expect(mapSample(ABHINAV).unparsedWhatsapp).toBeNull()
  })
})

describe('mapLeadRow: tier by vertical', () => {
  // The six Industry values found in the real file (297 rows).
  it.each([
    ['Interiors & Modular', 'core'],
    ['Coaching & Education', 'core'],
    ['Clinics, Diagnostics & Pharmacies', 'core'],
    ['Manufacturing & Furniture', 'core'],
    ['Real Estate & Construction', 'exploratory'],
    ['Automobile & Driving Schools', 'exploratory'],
  ])('maps vertical "%s" to tier "%s"', (vertical, tier) => {
    expect(tierForVertical(vertical)).toBe(tier)
    expect(mapLeadRow(rowWith({ Industry: vertical })).company.tier).toBe(tier)
  })

  it('puts Vision VVK Farms (Real Estate) in the exploratory tier', () => {
    expect(mapSample(VISION_VVK).company.tier).toBe('exploratory')
  })

  it('uses only those six verticals in the sample file', () => {
    const verticals = new Set(SAMPLE_ROWS.map((row) => row.Industry))

    expect([...verticals].sort()).toEqual([
      'Automobile & Driving Schools',
      'Clinics, Diagnostics & Pharmacies',
      'Coaching & Education',
      'Interiors & Modular',
      'Manufacturing & Furniture',
      'Real Estate & Construction',
    ])
  })
})

describe('mapLeadRow: website columns', () => {
  it.each([
    ['Best Cars (used cars)', 'justdial.com/Ahmedabad/...', true],
    ['NN Motors Multibrand Car Service Center', 'chatgpt.com/share/...', true],
    ['GSK Buildworks', 'https://netlify.app', true],
    [ALUBEST, 'https://alubestinteriors.netlify.app', false],
    [DIVYANK, 'https://divyankindustries.com', false],
  ])('flags %s (%s) as websiteInvalid=%s', (company, websiteUrl, websiteInvalid) => {
    const lead = mapSample(company)

    expect(lead.company.websiteUrl).toBe(websiteUrl)
    expect(lead.company.websiteInvalid).toBe(websiteInvalid)
  })

  it('has a null websiteUrl, and is not invalid, when the cell is empty', () => {
    const { company } = mapSample(ABHINAV)

    expect(company.websiteUrl).toBeNull()
    expect(company.websiteInvalid).toBe(false)
    expect(company.websiteStatus).toBe('Not checked yet')
  })

  it('flags a cell that is not a web address at all (real row "sameep.app listing")', () => {
    const { company } = mapLeadRow(rowWith({ Website: 'sameep.app listing' }))

    expect(company.websiteUrl).toBe('sameep.app listing')
    expect(company.websiteInvalid).toBe(true)
  })
})

describe('isPlatformUrl', () => {
  it.each([
    ['https://www.justdial.com/Hyderabad/Best-Cars', 'a directory page'],
    ['justdial.com/Ahmedabad/...', 'a directory page without a scheme'],
    ['https://indiamart.com', 'the IndiaMART root'],
    ['https://facebook.com/interiorpoint', 'a Facebook page'],
    ['https://instagram.com', 'the Instagram root'],
    ['https://youtube.com/@anilkollu9', 'a YouTube channel'],
    ['https://wa.me/message/HYR3Z3NYD6YUF1', 'a WhatsApp message link'],
    ['chatgpt.com/share/...', 'a ChatGPT share link'],
    ['https://netlify.app', 'the bare netlify.app root'],
    ['https://grexa.site', 'the bare grexa.site root'],
    ['https://blogspot.com', 'the bare blogspot.com root'],
  ])('is true for %s (%s)', (url) => {
    expect(isPlatformUrl(url)).toBe(true)
  })

  it.each([
    ['https://alubestinteriors.netlify.app', 'a business on a netlify.app subdomain'],
    ['https://drmohanphysio.business.site', 'a business on a business.site subdomain'],
    ['https://wallpap-wallcoverings.grexa.site', 'a business on a grexa.site subdomain'],
    ['https://divyankindustries.com', 'a business domain'],
    ['http://42.71.53.11/', 'a site served from an IP address'],
    ['https://justdial-style.example.com', 'a look-alike host that is not justdial.com'],
  ])('is false for %s (%s)', (url) => {
    expect(isPlatformUrl(url)).toBe(false)
  })
})

describe('hostOfUrl', () => {
  it.each([
    ['https://www.Example.com/path?x=1', 'example.com'],
    ['example.com/shop', 'example.com'],
    ['http://42.71.53.11/', '42.71.53.11'],
  ])('reads the host of %s as %s', (url, host) => {
    expect(hostOfUrl(url)).toBe(host)
  })

  it.each(['sameep.app listing', 'N/A', 'tbd', ''])('returns null for "%s"', (text) => {
    expect(hostOfUrl(text)).toBeNull()
  })
})

describe('mapLeadRow: numbers and priority', () => {
  it('reads blank rating and review counts as null (Abhinav has none)', () => {
    const { company } = mapSample(ABHINAV)

    expect(company.googleRating).toBeNull()
    expect(company.googleReviews).toBeNull()
  })

  it('reads a numeric rating, review count and score', () => {
    const { company } = mapLeadRow(
      rowWith({ 'Google Rating': '4.9', 'Google Reviews': '328', 'Lead Score': '60' }),
    )

    expect(company).toMatchObject({ googleRating: 4.9, googleReviews: 328, baseScore: 60 })
  })

  it('names the module, the company and the column when a number is text', () => {
    expect(() => mapLeadRow(rowWith({ 'Lead Score': 'high' }))).toThrow(
      /\[mapLeadRow\] map row "Divyank Industries \(Water Purification\)" failed: .*Lead Score.*"high"/,
    )
  })

  it('names the company and the column when the Priority is not A, B or C', () => {
    expect(() => mapLeadRow(rowWith({ Priority: 'Z' }))).toThrow(
      /\[mapLeadRow\] map row "Divyank Industries \(Water Purification\)" failed: .*Priority.*"Z"/,
    )
  })

  it('reads null for blank intent, problem, offer, opportunity and opener', () => {
    const lead = mapLeadRow(
      rowWith({
        'High Intent Signal': '',
        'Problem / Evidence': '',
        'Entry Offer': '',
        'Long-term Opportunity': '',
        'Call Opener': '',
      }),
    )

    expect(lead.company).toMatchObject({
      intentSignal: null,
      problemEvidence: null,
      entryOffer: null,
      longTermOpportunity: null,
    })
    expect(lead.opener).toBeNull()
  })

  it('refuses a row with no company name', () => {
    expect(() => mapLeadRow(rowWith({ 'Company Name': '  ' }))).toThrow(
      /\[mapLeadRow\] map row "\(no company name\)" failed: .*Company Name/,
    )
  })
})

describe('splitTags', () => {
  it('trims each tag and drops empty ones', () => {
    expect(splitTags('Interiors & Modular; Priority B ;;High intent;')).toEqual([
      'Interiors & Modular',
      'Priority B',
      'High intent',
    ])
  })

  it('returns no tags for an empty cell', () => {
    expect(splitTags('')).toEqual([])
  })
})

describe('the whole sample file', () => {
  it('maps all 25 rows without error and finds the two leads with no number', () => {
    const leads = SAMPLE_ROWS.map(mapLeadRow)

    expect(leads).toHaveLength(25)
    const needNumber = leads.filter((lead) => lead.needsNumber).map((lead) => lead.company.name)
    expect(needNumber).toEqual([DR_SATISH, 'M/s ARG Roofings'])
  })
})
