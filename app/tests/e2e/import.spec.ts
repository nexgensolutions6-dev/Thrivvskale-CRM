import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { adminClient, deleteUserAndWorkspaces, localStack } from '../db/support'
import { waitForMagicLink } from './mailpit'

const FIXTURE = fileURLToPath(new URL('../fixtures/leads-sample.csv', import.meta.url))

async function deleteUserByEmail(email: string) {
  const admin = adminClient(localStack())
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const user = data.users.find((candidate) => candidate.email === email)
  if (user) await deleteUserAndWorkspaces(localStack(), user.id)
}

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible()
  await page.goto(await waitForMagicLink(localStack(), email))
  await expect(page).toHaveURL(/\/today$/)
}

test.describe('Import screen', () => {
  let email: string

  test.beforeEach(() => {
    email = `e2e-import-${randomUUID()}@example.test`
  })

  test.afterEach(async () => {
    await deleteUserByEmail(email)
  })

  test('previews the fixture, imports it, and shows the inserted count', async ({ page }) => {
    await signIn(page, email)

    await page.goto('/more/import')
    await page.getByLabel('Lead CSV file').setInputFiles(FIXTURE)
    await page.getByRole('button', { name: 'Preview' }).click()

    const preview = page.getByRole('region', { name: 'Preview' })
    await expect(preview).toContainText('Rows25')
    await expect(preview).toContainText('Would insert25')

    await page.getByRole('button', { name: 'Confirm import' }).click()

    const report = page.getByRole('region', { name: 'Import report' })
    await expect(report).toContainText('Inserted25')
    await expect(report).toContainText('Updated0')
  })

  test('refuses a file that is not a CSV with a clear message', async ({ page }) => {
    await signIn(page, email)

    await page.goto('/more/import')
    await page.getByLabel('Lead CSV file').setInputFiles({
      name: 'leads.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    })
    await page.getByRole('button', { name: 'Preview' }).click()

    await expect(page.getByRole('alert').filter({ hasText: 'not a CSV file' })).toContainText('not a CSV file')
  })

  test('refuses a file over the size limit with a clear message, before sending it', async ({ page }) => {
    await signIn(page, email)

    await page.goto('/more/import')
    await page.getByLabel('Lead CSV file').setInputFiles({
      name: 'huge.csv',
      mimeType: 'text/csv',
      buffer: Buffer.alloc(3_000_000, 'a'),
    })

    const message = page.getByRole('alert').filter({ hasText: 'is too large' })
    await expect(message).toContainText('"huge.csv" is too large')
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(message).toContainText('is too large')
  })
})
