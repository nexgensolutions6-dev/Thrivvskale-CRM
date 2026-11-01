/**
 * Imports the real lead CSV (data/Thrivvskale_Leads_CRM_Import.csv) through the
 * More > Import screen, the same way the user will on production. Used by
 * golden-path.spec.ts and perf.spec.ts. The page must already be signed in.
 */
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'

const REAL_CSV = fileURLToPath(new URL('../../data/Thrivvskale_Leads_CRM_Import.csv', import.meta.url))

/** Previews and confirms the import, and returns how many leads were inserted. */
export async function importRealCsv(page: Page): Promise<number> {
  await page.goto('/more/import')
  await page.getByLabel('Lead CSV file').setInputFiles(REAL_CSV)
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Confirm import' }).click()

  const report = page.getByRole('region', { name: 'Import report' })
  await expect(report).toContainText('Inserted', { timeout: 120_000 })
  const text = (await report.locator('dt:text-is("Inserted") + dd').textContent()) ?? ''
  const count = Number(text.trim())
  if (!Number.isInteger(count)) throw new Error(`[e2e/real-csv] importRealCsv: the "Inserted" value is not a number, got ${JSON.stringify(text)}`)
  return count
}
