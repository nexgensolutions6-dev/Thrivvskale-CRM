/**
 * End-to-end checks of the objection drawer and the WhatsApp template picker
 * (Task 17): the drawer lists the five objections, shows the response in the
 * contact's mix when a variant exists and English with "Rewrite in your mix"
 * otherwise, a selected objection is saved with the outcome, and a chosen
 * template opens a wa.me link with the name filled in. Local stack only.
 */
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { adminClient, localStack } from '../db/support'
import { deleteUserByEmail, signIn } from './sign-in'

const PHONE = '+919866200001'
const emails: string[] = []

function admin() {
  return adminClient(localStack())
}

async function workspaceIdOf(email: string): Promise<string> {
  const users = await admin().auth.admin.listUsers({ perPage: 1000 })
  const user = users.data?.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`[objections.spec] no user ${email}`)
  const member = await admin().from('members').select('workspace_id').eq('user_id', user.id).single()
  if (member.error) throw new Error(`[objections.spec] find workspace failed: ${member.error.message}`)
  return member.data.workspace_id
}

async function addLead(workspaceId: string): Promise<string> {
  const company = await admin().from('companies').insert({
    workspace_id: workspaceId, name: 'Objection Lead', priority: 'A', tier: 'core',
    vertical: 'Coaching & Education', state: 'Telangana',
  }).select('id').single()
  if (company.error) throw new Error(`[objections.spec] insert company failed: ${company.error.message}`)
  const contact = await admin().from('contacts').insert({
    workspace_id: workspaceId, company_id: company.data.id, name: 'Ramesh', role: 'owner', mix_profile: 'te+en',
  }).select('id').single()
  if (contact.error) throw new Error(`[objections.spec] insert contact failed: ${contact.error.message}`)
  const point = await admin().from('contact_points').insert({
    workspace_id: workspaceId, company_id: company.data.id, contact_id: contact.data.id, e164: PHONE, kind: 'business',
  })
  if (point.error) throw new Error(`[objections.spec] insert point failed: ${point.error.message}`)
  return company.data.id
}

/** A Telugu+English answer for "Too expensive", linked to the seeded English one. */
async function addTeluguResponse(workspaceId: string): Promise<void> {
  const objection = await admin().from('objections').select('suggested_response_id')
    .eq('workspace_id', workspaceId).eq('text', 'Too expensive').single()
  if (objection.error) throw new Error(`[objections.spec] read objection failed: ${objection.error.message}`)
  const inserted = await admin().from('content_variants').insert({
    workspace_id: workspaceId, kind: 'objection_response', mix: 'te+en', body: 'Telugu mix answer about price',
    parent_variant_id: objection.data.suggested_response_id,
  })
  if (inserted.error) throw new Error(`[objections.spec] insert variant failed: ${inserted.error.message}`)
}

async function setUp(page: Page): Promise<{ workspaceId: string; companyId: string }> {
  const email = `obj-${randomUUID()}@example.test`
  emails.push(email)
  await signIn(page, email)
  const workspaceId = await workspaceIdOf(email)
  const companyId = await addLead(workspaceId)
  await page.goto('/call')
  await expect(page.getByRole('heading', { name: 'Objection Lead' })).toBeVisible()
  return { workspaceId, companyId }
}

test.afterAll(async () => {
  for (const email of emails) await deleteUserByEmail(email)
})

test.describe('objection drawer', () => {
  test('lists the five seeded objections', async ({ page }) => {
    await setUp(page)
    await page.getByRole('button', { name: 'Objections', exact: true }).click()
    const list = page.getByRole('list', { name: 'Objections' })
    await expect(list.getByRole('button')).toHaveText([
      'Call back later', 'Not now', 'Send details on WhatsApp', 'Too expensive', 'We already have someone',
    ])
  })

  test('shows English with a rewrite button when the mix has no variant', async ({ page }) => {
    await setUp(page)
    await page.getByRole('button', { name: 'Objections', exact: true }).click()
    await page.getByRole('button', { name: 'Too expensive' }).click()
    await expect(page.getByTestId('objection-response')).toContainText('start small')
    await expect(page.getByRole('button', { name: 'Rewrite in your mix' })).toBeVisible()
  })

  test('the rewrite button asks the server for a draft and fails in plain words without a model', async ({ page }) => {
    await setUp(page)
    await page.getByRole('button', { name: 'Objections', exact: true }).click()
    await page.getByRole('button', { name: 'Too expensive' }).click()
    const asked = page.waitForRequest((request) => request.method() === 'POST' && 'next-action' in request.headers())
    await page.getByRole('button', { name: 'Rewrite in your mix' }).click()
    await asked
    // The test server has no model key; Task 11's tests cover the draft itself.
    await expect(page.getByText('The rewrite could not be written. Try again in a moment.')).toBeVisible()
  })

  test('shows the response in the contact mix when a variant exists, with no rewrite button', async ({ page }) => {
    const { workspaceId } = await setUp(page)
    await addTeluguResponse(workspaceId)
    await page.reload()
    await page.getByRole('button', { name: 'Objections', exact: true }).click()
    await page.getByRole('button', { name: 'Too expensive' }).click()
    await expect(page.getByTestId('objection-response')).toHaveText('Telugu mix answer about price')
    await expect(page.getByRole('button', { name: 'Rewrite in your mix' })).toHaveCount(0)
  })

  test('a selected objection is saved with the outcome', async ({ page }) => {
    const { workspaceId, companyId } = await setUp(page)
    await page.getByRole('button', { name: 'Objections', exact: true }).click()
    await page.getByRole('button', { name: 'Not now' }).click()
    await page.getByRole('button', { name: 'Log an outcome' }).click()
    await expect(page.getByRole('checkbox', { name: 'Not now' })).toBeChecked()
    await page.getByRole('button', { name: 'Interested', exact: true }).click()
    await page.getByRole('button', { name: 'Save outcome' }).click()

    await expect(async () => {
      const activities = await admin().from('activities').select('id').eq('company_id', companyId).eq('type', 'call')
      const calls = await admin().from('calls').select('objection_ids').in('activity_id', (activities.data ?? []).map((row) => row.id))
      const objection = await admin().from('objections').select('id').eq('workspace_id', workspaceId).eq('seed_key', 'objection:not_now')
      expect(calls.data).toHaveLength(1)
      expect(calls.data?.[0].objection_ids).toContain(objection.data?.[0].id)
    }).toPass({ timeout: 15_000 })
  })
})

test.describe('WhatsApp template picker', () => {
  test('a chosen template opens a wa.me link with the name filled in', async ({ page }) => {
    await setUp(page)
    await page.getByRole('button', { name: 'Log an outcome' }).click()
    await page.getByLabel('Template').selectOption({ label: 'Thanks after the call' })

    await expect(page.getByTestId('template-text')).toContainText('Hello Ramesh garu, thank you')
    const link = page.getByRole('link', { name: /^WhatsApp/ })
    const href = (await link.getAttribute('href')) ?? ''
    expect(href).toMatch(/^https:\/\/wa\.me\/919866200001\?text=/)
    expect(decodeURIComponent(href)).toContain('Hello Ramesh garu')
    expect(decodeURIComponent(href)).toContain('Objection Lead')
    expect(href).not.toContain('%7Bname%7D')
  })
})
