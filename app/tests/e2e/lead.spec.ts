/**
 * End-to-end checks of the lead list and the lead workspace (Task 14): the
 * Divyank lead shows its Problem / Evidence, Entry Offer and opener; a lead
 * with no entry offer shows its vertical's default; a landline gets no
 * WhatsApp button; adding a person with name_latin makes the lead findable;
 * the pages fit a 390px phone. The CSV fixture is imported once per run.
 * Local Supabase stack only.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { adminClient, localStack } from '../db/support'
import { deleteUserByEmail, signIn } from './sign-in'

const FIXTURE = fileURLToPath(new URL('../fixtures/leads-sample.csv', import.meta.url))
const MOBILE = { width: 390, height: 844 }
// Divyank's real CSV opener, read from the fixture: the import must store it, nothing seeds it.
const DIVYANK_NAME = 'Divyank Industries (Water Purification)'
const OPENER_TEXT = openerOf(DIVYANK_NAME)

function openerOf(company: string): string {
  const lines = readFileSync(FIXTURE, 'utf8').split(/\r?\n/)
  const line = lines.find((candidate) => candidate.includes(company))
  const match = line?.match(/"(Saw you[^"]*)"/)
  if (!match) throw new Error(`[lead.spec] no Call Opener for "${company}" in the fixture`)
  return match[1]
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    inner: window.innerWidth,
  }))
  expect(widths.scroll, `scrollWidth ${widths.scroll} vs innerWidth ${widths.inner}`).toBeLessThanOrEqual(widths.inner)
}

async function workspaceIdOf(email: string): Promise<string> {
  const admin = adminClient(localStack())
  const users = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (users.error) throw new Error(`[lead.spec] list users failed: ${users.error.message}`)
  const user = users.data.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`[lead.spec] no user ${email}`)
  const member = await admin.from('members').select('workspace_id').eq('user_id', user.id).single()
  if (member.error) throw new Error(`[lead.spec] find workspace of ${email} failed: ${member.error.message}`)
  return member.data.workspace_id
}

async function companyIdByName(workspaceId: string, name: string): Promise<string> {
  const found = await adminClient(localStack())
    .from('companies').select('id').eq('workspace_id', workspaceId).eq('name', name).single()
  if (found.error) throw new Error(`[lead.spec] find company "${name}" failed: ${found.error.message}`)
  return found.data.id
}

/** Imports the CSV through the Import screen, then adds the data the CSV does not carry. */
async function seedWorkspace(page: Page, email: string): Promise<void> {
  await signIn(page, email)
  await page.goto('/more/import')
  await page.getByLabel('Lead CSV file').setInputFiles(FIXTURE)
  await page.getByRole('button', { name: 'Preview' }).click()
  await page.getByRole('button', { name: 'Confirm import' }).click()
  await expect(page.getByRole('region', { name: 'Import report' })).toContainText('Inserted25')

  const workspaceId = await workspaceIdOf(email)
  const admin = adminClient(localStack())
  const defaults = await admin.from('vertical_defaults').select('vertical, entry_offer').eq('workspace_id', workspaceId)
  const withOffer = defaults.data?.find((row) => row.entry_offer)
  if (!withOffer) throw new Error('[lead.spec] the import saved no vertical default offer')
  const plain = await admin.from('companies').insert({
    workspace_id: workspaceId, name: 'Default Offer Co', vertical: withOffer.vertical, entry_offer: null,
  })
  if (plain.error) throw new Error(`[lead.spec] insert Default Offer Co failed: ${plain.error.message}`)

  const phones = await admin.from('companies').insert({
    workspace_id: workspaceId, name: 'Phones Co', website_url: 'http://localhost/health',
  }).select('id').single()
  if (phones.error) throw new Error(`[lead.spec] insert Phones Co failed: ${phones.error.message}`)
  // Phones Co is not in the CSV, so it gets its own opener (the WhatsApp link needs one to carry).
  const phonesOpener = await admin.from('content_variants').insert({
    workspace_id: workspaceId, company_id: phones.data.id, kind: 'opener', mix: 'te+en', body: 'Namaskaram Suresh garu',
  })
  if (phonesOpener.error) throw new Error(`[lead.spec] insert Phones Co opener failed: ${phonesOpener.error.message}`)
  const contact = await admin.from('contacts').insert({
    workspace_id: workspaceId, company_id: phones.data.id, name_latin: 'Suresh', role: 'decision_maker', mix_profile: 'te+en',
  }).select('id').single()
  if (contact.error) throw new Error(`[lead.spec] insert contact failed: ${contact.error.message}`)
  const points = await admin.from('contact_points').insert([
    {
      workspace_id: workspaceId, company_id: phones.data.id, contact_id: contact.data.id,
      e164: '+919866139901', kind: 'business', wa_status: 'unconfirmed',
    },
    {
      workspace_id: workspaceId, company_id: phones.data.id, contact_id: null,
      e164: '+914023456789', kind: 'landline', wa_status: 'landline',
    },
  ])
  if (points.error) throw new Error(`[lead.spec] insert phone points failed: ${points.error.message}`)
}

test.describe('Lead list and workspace', () => {
  // One worker runs them all in order: the CSV is imported once, in beforeAll.
  test.describe.configure({ mode: 'serial' })

  const email = `e2e-lead-${randomUUID()}@example.test`
  let workspaceId = ''

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000)
    const page = await browser.newPage()
    try {
      await seedWorkspace(page, email)
      workspaceId = await workspaceIdOf(email)
    } finally {
      await page.close()
    }
  })

  test.beforeEach(async ({ page }) => {
    await signIn(page, email)
  })

  test.afterAll(async () => {
    await deleteUserByEmail(email)
  })

  test('the list searches and filters, and opens a lead', async ({ page }) => {
    await page.goto('/leads')
    await expect(page.getByRole('heading', { name: 'Leads', level: 1 })).toBeVisible()
    await page.getByLabel('Search').fill('balanagar')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page).toHaveURL(/q=balanagar/)
    const row = page.getByRole('link', { name: /Divyank Industries/ })
    await expect(row).toBeVisible()
    await row.click()
    await expect(page.getByRole('heading', { name: /Divyank Industries/, level: 1 })).toBeVisible()
  })

  test('the list filters by priority', async ({ page }) => {
    await page.goto('/leads?priority=C')
    for (const text of await page.getByRole('list', { name: 'Leads' }).getByRole('listitem').allInnerTexts()) {
      expect(text).toContain('Priority C')
    }
  })

  test('Divyank shows Problem / Evidence, the entry offer and the opener', async ({ page }) => {
    const id = await companyIdByName(workspaceId, DIVYANK_NAME)
    await page.goto(`/leads/${id}`)
    await expect(page.getByRole('heading', { name: 'Why call' })).toBeVisible()
    await expect(page.getByText('HIRING 2 telecallers on Apna')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Problem / Evidence' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Entry offer' })).toBeVisible()
    await expect(page.getByTestId('opener-text')).toHaveText(OPENER_TEXT)
    await expect(page.getByText(openerOf('Abhinav Eye Care Centers'))).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Open .* in Google Maps/ })).toHaveAttribute('href', /google\.com\/maps/)
    await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible()
    await page.getByRole('tab', { name: 'Tasks' }).click()
    await expect(page.getByText('No tasks for this lead.')).toBeVisible()
  })

  test('a lead with no entry offer shows its vertical default', async ({ page }) => {
    const id = await companyIdByName(workspaceId, 'Default Offer Co')
    await page.goto(`/leads/${id}`)
    await expect(page.getByText('Vertical default')).toBeVisible()
  })

  test('a landline gets no WhatsApp button, a mobile does', async ({ page }) => {
    const id = await companyIdByName(workspaceId, 'Phones Co')
    await page.goto(`/leads/${id}`)
    await expect(page.getByRole('link', { name: 'WhatsApp Suresh' })).toHaveAttribute('href', /^https:\/\/wa\.me\/919866139901/)
    await expect(page.getByRole('link', { name: /^WhatsApp/ })).toHaveCount(1)
    await expect(page.getByRole('link', { name: '+914023456789' })).toBeVisible()
  })

  test('re-check refuses a private address and says so', async ({ page }) => {
    const id = await companyIdByName(workspaceId, 'Phones Co')
    await page.goto(`/leads/${id}`)
    await page.getByRole('button', { name: 'Re-check website' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'could not run' })).toBeVisible()
  })

  test('adding a person with name_latin makes the lead findable by that name', async ({ page }) => {
    const id = await companyIdByName(workspaceId, 'Default Offer Co')
    await page.goto(`/leads/${id}`)
    await page.getByText('Add a person').click()
    await page.getByLabel('Name', { exact: true }).fill('రమేష్')
    await page.getByLabel('Name in English letters').fill('ramesh')
    await page.getByLabel('Role').selectOption('decision_maker')
    await page.getByLabel('Phone number').fill('98661 39902')
    await page.getByRole('button', { name: 'Add person' }).click()
    await expect(page.getByText('Saved')).toBeVisible()
    await expect(page.getByText('+919866139902')).toBeVisible()

    await page.goto('/leads?q=ramsh')
    await expect(page.getByRole('link', { name: /Default Offer Co/ })).toBeVisible()
  })

  test('a note appears on the timeline', async ({ page }) => {
    const id = await companyIdByName(workspaceId, 'Default Offer Co')
    await page.goto(`/leads/${id}`)
    await page.getByLabel('Add a note').fill('Asked for a quote by Friday')
    await page.getByRole('button', { name: 'Save note' }).click()
    await expect(page.getByRole('list', { name: 'Activity history' })).toContainText('Asked for a quote by Friday')
  })

  test('a lead that is not in this workspace is a 404', async ({ page }) => {
    const response = await page.goto('/leads/00000000-0000-4000-8000-000000000000')
    expect(response?.status()).toBe(404)
  })

  test('the list and the lead page fit a 390px phone', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/leads')
    await expectNoHorizontalScroll(page)
    const id = await companyIdByName(workspaceId, DIVYANK_NAME)
    await page.goto(`/leads/${id}`)
    await expect(page.getByRole('heading', { name: 'Why call' })).toBeVisible()
    await expectNoHorizontalScroll(page)
    const phonesId = await companyIdByName(workspaceId, 'Phones Co')
    await page.goto(`/leads/${phonesId}`)
    await expect(page.getByRole('heading', { name: 'People and numbers' })).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
