import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, readLeadUpload } from '@/lib/import/readLeadUpload'

const GOOD_CSV = [
  'Company Name,Phone,Industry,Priority,Lead Score,WhatsApp Status',
  'Acme Clinic,+919866139900,"Clinics, Diagnostics & Pharmacies",A,65,Not verified',
].join('\n')

function formWith(file: File | string | null): FormData {
  const form = new FormData()
  if (file !== null) form.set('file', file)
  return form
}

describe('readLeadUpload', () => {
  it('reads a CSV upload into raw rows and mapped leads', async () => {
    const upload = await readLeadUpload(formWith(new File([GOOD_CSV], 'leads.csv', { type: 'text/csv' })))

    expect(upload.fileName).toBe('leads.csv')
    expect(upload.rawRows).toHaveLength(1)
    expect(upload.leads[0].company.name).toBe('Acme Clinic')
  })

  it('accepts a .csv file whose browser type is empty or application/vnd.ms-excel', async () => {
    await expect(readLeadUpload(formWith(new File([GOOD_CSV], 'a.CSV', { type: '' })))).resolves.toBeDefined()
    await expect(
      readLeadUpload(formWith(new File([GOOD_CSV], 'a.csv', { type: 'application/vnd.ms-excel' }))),
    ).resolves.toBeDefined()
  })

  it('rejects a missing file', async () => {
    await expect(readLeadUpload(formWith(null))).rejects.toThrow(/choose a CSV file/i)
    await expect(readLeadUpload(formWith('not a file'))).rejects.toThrow(/choose a CSV file/i)
  })

  it('rejects an empty file', async () => {
    await expect(readLeadUpload(formWith(new File([], 'leads.csv')))).rejects.toThrow(/empty/i)
  })

  it('rejects a file that is not a CSV, naming the file', async () => {
    const pdf = new File(['%PDF-1.4'], 'leads.pdf', { type: 'application/pdf' })

    await expect(readLeadUpload(formWith(pdf))).rejects.toThrow(/leads\.pdf.*not a CSV/i)
  })

  it('rejects an oversized file before reading it', async () => {
    const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.csv', { type: 'text/csv' })

    await expect(readLeadUpload(formWith(big))).rejects.toThrow(/too large/i)
  })

  it('names the module and company when a row cannot be mapped', async () => {
    const bad = GOOD_CSV.replace(',A,', ',Z,')

    await expect(readLeadUpload(formWith(new File([bad], 'leads.csv')))).rejects.toThrow(
      /\[mapLeadRow\].*Acme Clinic/,
    )
  })

  it('rejects a CSV with no data rows', async () => {
    const headerOnly = 'Company Name,Phone\n'

    await expect(readLeadUpload(formWith(new File([headerOnly], 'leads.csv')))).rejects.toThrow(/no rows/i)
  })
})
