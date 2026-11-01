/**
 * Release check (Task 19): sign in, import the real CSV, place a STUBBED call, log
 * "callback", see it on Today, build a Hinglish WhatsApp link (never opened). Local stack only.
 */
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { adminClient, localStack } from '../db/support'
import { pressCallThenReturn, stubTelLinks, workspaceIdOf } from './call-helpers'
import { importRealCsv } from './real-csv'
import { deleteUserByEmail, signIn } from './sign-in'

const AWAY_MS = 20_000
const HOUR_MS = 3_600_000
const TEMPLATE_TITLE = 'Thanks after the call'
const GREETING_NAME = 'Ramesh'
const HINGLISH_BODY =
  'Namaste {name} {honorific}, abhi baat karke accha laga. Main Yaswanth, ThrivvSkale se. ' +
  '{company} ke liye kya sahi rahega, main dekh kar aapko yahin WhatsApp karta hoon.'

const admin = () => adminClient(localStack())

/** Returns the data of a Supabase result, or throws naming the step, so a failure points at the step. */
function must<T>(step: string, result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(`[golden-path.spec] ${step} failed: ${result.error.message}`)
  if (result.data === null || result.data === undefined) throw new Error(`[golden-path.spec] ${step} returned no data`)
  return result.data as NonNullable<T>
}

/**
 * Gives the lead a contact who speaks Hindi + English, attaches its numbers to that contact,
 * marks them as able to receive WhatsApp, and stores a Hinglish version of the template.
 * Returns the lead's numbers as digits only (the form wa.me uses).
 */
async function makeLeadHinglish(workspaceId: string, companyName: string): Promise<string[]> {
  const companies = must('find lead by name', await admin().from('companies').select('id')
    .eq('workspace_id', workspaceId).eq('name', companyName))
  if (companies.length !== 1) {
    throw new Error(`[golden-path.spec] makeLeadHinglish: expected one lead named ${companyName}, found ${companies.length}`)
  }
  const companyId = companies[0].id

  const contact = must('insert contact', await admin().from('contacts').insert({
    workspace_id: workspaceId, company_id: companyId, name: GREETING_NAME, role: 'owner', mix_profile: 'hi+en',
  }).select('id').single())
  must('attach numbers to contact', await admin().from('contact_points')
    .update({ contact_id: contact.id, wa_status: 'unconfirmed' }).eq('company_id', companyId).select('id'))
  const points = must('read numbers', await admin().from('contact_points').select('e164').eq('company_id', companyId))

  const original = must('find template', await admin().from('content_variants').select('id')
    .eq('workspace_id', workspaceId).eq('kind', 'template').eq('title', TEMPLATE_TITLE)
    .is('parent_variant_id', null).single())
  must('insert hinglish template', await admin().from('content_variants').insert({
    workspace_id: workspaceId, kind: 'template', mix: 'hi+en', script: 'latin', register: 'formal',
    body: HINGLISH_BODY, parent_variant_id: original.id,
  }).select('id'))
  return points.map((point) => point.e164.replace(/\D/g, ''))
}

test.describe('Golden path', () => {
  let email: string

  test.beforeEach(() => {
    email = `golden-${randomUUID()}@example.test`
  })

  test.afterEach(async () => {
    await deleteUserByEmail(email)
  })

  test('import, call, callback on Today, Hinglish WhatsApp link', async ({ page }) => {
    test.setTimeout(240_000)
    await signIn(page, email)
    const workspaceId = await workspaceIdOf(email)

    const inserted = await importRealCsv(page)
    expect(inserted, 'leads inserted from the real CSV').toBeGreaterThan(250)

    // The first <h2> of the call card is the lead's name (CallCard.tsx).
    await page.clock.install()
    await page.goto('/call')
    const nameHeading = page.getByRole('heading', { level: 2 }).first()
    await expect(nameHeading).toBeVisible()
    const companyName = ((await nameHeading.textContent()) ?? '').trim()
    expect(companyName.length, 'top lead name').toBeGreaterThan(0)

    const waDigits = await makeLeadHinglish(workspaceId, companyName)
    await page.reload()
    await expect(page.getByRole('heading', { level: 2, name: companyName })).toBeVisible()
    await stubTelLinks(page)
    await pressCallThenReturn(page, AWAY_MS)

    const sheet = page.getByRole('dialog', { name: /How did the call/ })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Callback', exact: true }).click()

    await sheet.getByLabel('Template').selectOption({ label: TEMPLATE_TITLE })
    const expectedText = HINGLISH_BODY
      .replace('{name}', GREETING_NAME).replace('{honorific}', 'ji').replace('{company}', companyName)
    await expect(sheet.getByTestId('template-text')).toHaveText(expectedText)
    const href = (await sheet.getByRole('link', { name: /^WhatsApp / }).getAttribute('href')) ?? ''
    const link = new URL(href)
    expect(link.origin, 'WhatsApp link host').toBe('https://wa.me')
    expect(waDigits, 'wa.me number is one of the lead numbers').toContain(link.pathname.slice(1))
    expect(link.searchParams.get('text')).toBe(expectedText)

    await sheet.getByRole('button', { name: 'Save outcome' }).click()
    await expect(sheet).toBeHidden()

    const company = must('find lead id', await admin().from('companies').select('id')
      .eq('workspace_id', workspaceId).eq('name', companyName).single())
    await expect.poll(async () => {
      const activities = must('read call activities', await admin().from('activities').select('id')
        .eq('company_id', company.id).eq('type', 'call'))
      const calls = must('read calls', await admin().from('calls').select('outcome')
        .in('activity_id', activities.map((row) => row.id)))
      return calls.map((row) => row.outcome)
    }).toEqual(['callback'])

    // The callback is booked for the next working slot. Move it to an hour ago, as if that slot had come.
    must('make callback due', await admin().from('tasks')
      .update({ due_at: new Date(Date.now() - HOUR_MS).toISOString() })
      .eq('company_id', company.id).eq('type', 'callback').select('id'))
    await page.goto('/today')
    const row = page.getByTestId('due-list').getByRole('listitem').filter({ hasText: `Call back ${companyName}` })
    await expect(row).toHaveAttribute('data-kind', 'callback')
    await expect(row.getByRole('link', { name: companyName })).toHaveAttribute('href', `/leads/${company.id}`)
  })
})
