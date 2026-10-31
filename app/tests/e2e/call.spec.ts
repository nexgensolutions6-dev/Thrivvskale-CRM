/**
 * End-to-end checks of the calling cockpit (Task 15): top lead shown, return
 * from the dialer opens the outcome sheet, a return under 5 seconds does not,
 * "Didn't call" logs nothing, Callback logs and advances, offline outcomes sync
 * on reconnect, refused outcomes, an expired session during a flush, the empty
 * queue, the QR fallback and voice notes with the save guard. Local stack only.
 */
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import jsQR from 'jsqr'
import sharp from 'sharp'
import { BEST_WINDOWS } from '../../src/lib/calendar/windows'
import { kolkataInstant, kolkataYmd, addDays, isoWeekday } from '../../src/lib/calendar/kolkataDate'
import { adminClient, localStack } from '../db/support'
import { deleteUserByEmail, signIn } from './sign-in'

const AWAY_MS = 20_000
const FIRST_PHONE = '+919866100001'
const emails: string[] = []

function admin() {
  return adminClient(localStack())
}

async function workspaceIdOf(email: string): Promise<string> {
  const users = await admin().auth.admin.listUsers({ perPage: 1000 })
  const user = users.data?.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`[call.spec] no user ${email}`)
  const member = await admin().from('members').select('workspace_id').eq('user_id', user.id).single()
  if (member.error) throw new Error(`[call.spec] find workspace failed: ${member.error.message}`)
  return member.data.workspace_id
}

async function addLead(workspaceId: string, name: string, priority: 'A' | 'B', phone: string): Promise<string> {
  const company = await admin().from('companies').insert({
    workspace_id: workspaceId, name, priority, tier: 'core', vertical: 'Coaching & Education', state: 'Telangana',
    problem_evidence: `Evidence for ${name}`,
  }).select('id').single()
  if (company.error) throw new Error(`[call.spec] insert ${name} failed: ${company.error.message}`)
  const contact = await admin().from('contacts').insert({
    workspace_id: workspaceId, company_id: company.data.id, name: 'Ramesh', role: 'owner', mix_profile: 'te+en',
  }).select('id').single()
  if (contact.error) throw new Error(`[call.spec] insert contact failed: ${contact.error.message}`)
  const point = await admin().from('contact_points').insert({
    workspace_id: workspaceId, company_id: company.data.id, contact_id: contact.data.id, e164: phone, kind: 'business',
  })
  if (point.error) throw new Error(`[call.spec] insert point failed: ${point.error.message}`)
  const opener = await admin().from('content_variants').insert({
    workspace_id: workspaceId, kind: 'opener', company_id: company.data.id, body: `Opener for ${name}`,
  })
  if (opener.error) throw new Error(`[call.spec] insert opener failed: ${opener.error.message}`)
  return company.data.id
}

async function setUp(page: Page, leads: number): Promise<{ workspaceId: string; ids: string[] }> {
  const email = `call-${randomUUID()}@example.test`
  emails.push(email)
  await signIn(page, email)
  const workspaceId = await workspaceIdOf(email)
  const ids: string[] = []
  if (leads >= 1) ids.push(await addLead(workspaceId, 'First Lead', 'A', FIRST_PHONE))
  if (leads >= 2) ids.push(await addLead(workspaceId, 'Second Lead', 'B', '+919866100002'))
  return { workspaceId, ids }
}

async function callOutcomes(companyId: string): Promise<string[]> {
  const activities = await admin().from('activities').select('id').eq('company_id', companyId).eq('type', 'call')
  const ids = (activities.data ?? []).map((row) => row.id)
  const calls = await admin().from('calls').select('outcome').in('activity_id', ids)
  return (calls.data ?? []).map((row) => row.outcome)
}

/** How many rows the browser's outbox holds. Read directly, as the page may have moved on. */
async function storedCounts(page: Page, workspaceId: string): Promise<{ ops: number; deadLetters: number }> {
  return page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const count = (store: string) => new Promise<number>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const counts = { ops: await count('ops'), deadLetters: await count('dead-letters') }
    db.close()
    return counts
  }, `thrivvskale-outbox-${workspaceId}`)
}

/** Stops the tel: link from leaving the page, so the click only starts the "away" timer. */
async function stubTelLinks(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      if (target.closest('a[href^="tel:"]')) event.preventDefault()
    })
  })
}

async function pressCallThenReturn(page: Page, awayMs: number): Promise<void> {
  await page.getByRole('link', { name: /^Call / }).click()
  await page.clock.fastForward(awayMs)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

async function openCockpit(page: Page): Promise<void> {
  await page.clock.install()
  await page.goto('/call')
  await expect(page.getByRole('heading', { name: 'First Lead' })).toBeVisible()
  await stubTelLinks(page)
}

/** The first working Kolkata day after today, at the coaching window start. */
function expectedSlot(from: Date): string {
  let day = addDays(kolkataYmd(from), 1)
  while (isoWeekday(day) === 7) day = addDays(day, 1)
  return kolkataInstant(day, BEST_WINDOWS.coaching.start).toISOString()
}

// A fake microphone for the voice-note test. Playwright allows launch options only at file level.
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['microphone'],
})

test.afterAll(async () => {
  for (const email of emails) await deleteUserByEmail(email)
})

test('shows the top-ranked lead with its opener', async ({ page }) => {
  await setUp(page, 2)
  await page.goto('/call')
  await expect(page.getByRole('heading', { name: 'First Lead' })).toBeVisible()
  await expect(page.getByTestId('opener-text')).toHaveText('Opener for First Lead')
  await expect(page.getByText('Evidence for First Lead')).toBeVisible()
  await expect(page.getByRole('link', { name: /^Call / })).toHaveAttribute('href', `tel:${FIRST_PHONE}`)
})

test('returning after 20 s opens the sheet; "Didn\'t call" closes it and logs nothing', async ({ page }) => {
  const { ids } = await setUp(page, 2)
  await openCockpit(page)
  await pressCallThenReturn(page, AWAY_MS)

  const sheet = page.getByRole('dialog', { name: /How did the call/ })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByLabel(/Call length/)).toHaveValue('20')
  await expect(sheet.getByText('Estimated from time away')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Telugu' })).toHaveAttribute('aria-pressed', 'true')

  await sheet.getByRole('button', { name: "Didn't call" }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('heading', { name: 'First Lead' })).toBeVisible()
  expect(await callOutcomes(ids[0])).toEqual([])
})

test('returning within 5 seconds means the call was not placed', async ({ page }) => {
  const { ids } = await setUp(page, 1)
  await openCockpit(page)
  await pressCallThenReturn(page, 3_000)

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Call / })).toBeVisible()
  expect(await callOutcomes(ids[0])).toEqual([])
})

test('Callback logs the call, creates a task at the next slot and advances', async ({ page }) => {
  const { ids } = await setUp(page, 2)
  await openCockpit(page)
  await pressCallThenReturn(page, AWAY_MS)

  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Callback', exact: true }).click()
  const expected = expectedSlot(new Date())
  await sheet.getByRole('button', { name: 'Save outcome' }).click()

  await expect(page.getByRole('heading', { name: 'Second Lead' })).toBeVisible()
  await expect.poll(() => callOutcomes(ids[0])).toEqual(['callback'])
  const task = await admin().from('tasks').select('type, due_at').eq('company_id', ids[0]).single()
  expect(task.data?.type).toBe('callback')
  expect(new Date(task.data?.due_at ?? '').toISOString()).toBe(expected)
})

test('offline, the outcome is queued and reaches the server on reconnect', async ({ page, context }) => {
  const { ids } = await setUp(page, 2)
  await openCockpit(page)
  await pressCallThenReturn(page, AWAY_MS)
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Interested', exact: true }).click()

  await context.setOffline(true)
  await sheet.getByRole('button', { name: 'Save outcome' }).click()
  await expect(page.getByRole('heading', { name: 'Second Lead' })).toBeVisible()
  await expect(page.getByTestId('outbox-status')).toContainText('1 outcome waiting')
  expect(await callOutcomes(ids[0])).toEqual([])

  await context.setOffline(false)
  await expect.poll(() => callOutcomes(ids[0]), { timeout: 20_000 }).toEqual(['interested'])
  await expect(page.getByTestId('outbox-status')).toHaveCount(0)
})

test('a refused outcome is set aside by name, the queue flows, and only a named confirm removes it', async ({
  page,
}) => {
  const { ids } = await setUp(page, 2)
  await openCockpit(page)
  await pressCallThenReturn(page, AWAY_MS)
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Interested', exact: true }).click()

  // The number disappears after the lead was loaded, so the server will refuse this for good.
  const removed = await admin().from('contact_points').delete().eq('company_id', ids[0])
  if (removed.error) throw new Error(`[call.spec] delete number failed: ${removed.error.message}`)
  await sheet.getByRole('button', { name: 'Save outcome' }).click()

  await expect(page.getByRole('heading', { name: 'Second Lead' })).toBeVisible()
  const refused = page.getByTestId('refused-outcomes')
  await expect(refused).toContainText('First Lead: Interested')
  await expect(refused).toContainText('is not its number')
  await expect(page.getByTestId('outbox-status')).toHaveCount(0)
  expect(await callOutcomes(ids[0])).toEqual([])

  const questions: string[] = []
  page.once('dialog', (dialog) => {
    questions.push(dialog.message())
    void dialog.dismiss()
  })
  await refused.getByRole('button', { name: 'Remove' }).click()
  await expect(refused).toBeVisible()
  expect(questions[0]).toMatch(/Interested.*First Lead/)

  page.once('dialog', (dialog) => void dialog.accept())
  await refused.getByRole('button', { name: 'Remove' }).click()
  await expect(refused).toHaveCount(0)
})

test('an expired session during a flush keeps the outcome queued and it sends after signing back in', async ({
  page,
  context,
}) => {
  const { ids, workspaceId } = await setUp(page, 2)
  await openCockpit(page)
  await pressCallThenReturn(page, AWAY_MS)
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Interested', exact: true }).click()

  const cookies = await context.cookies()
  await context.clearCookies()
  await sheet.getByRole('button', { name: 'Save outcome' }).click()
  await expect.poll(() => storedCounts(page, workspaceId)).toEqual({ ops: 1, deadLetters: 0 })
  expect(await callOutcomes(ids[0])).toEqual([])

  await context.addCookies(cookies)
  await page.goto('/call')
  await expect.poll(() => callOutcomes(ids[0]), { timeout: 20_000 }).toEqual(['interested'])
  await expect.poll(() => storedCounts(page, workspaceId)).toEqual({ ops: 0, deadLetters: 0 })
})

test('a guess over 4 hours is dropped and a bad typed length stays in the sheet', async ({ page }) => {
  const { ids } = await setUp(page, 2)
  await openCockpit(page)
  await pressCallThenReturn(page, 5 * 60 * 60 * 1000)

  const sheet = page.getByRole('dialog')
  await expect(sheet.getByLabel(/Call length/)).toHaveValue('')
  await expect(sheet.getByText('Estimated from time away')).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Busy', exact: true }).click()

  await sheet.getByLabel(/Call length/).fill('-1')
  await sheet.getByRole('button', { name: 'Save outcome' }).click()
  await expect(sheet.getByRole('alert')).toContainText('Call length must be a whole number')
  expect(await callOutcomes(ids[0])).toEqual([])

  await sheet.getByLabel(/Call length/).fill('')
  await sheet.getByRole('button', { name: 'Save outcome' }).click()
  await expect(page.getByRole('heading', { name: 'Second Lead' })).toBeVisible()
  await expect.poll(() => callOutcomes(ids[0])).toEqual(['busy'])
})

test('an empty queue says All caught up', async ({ page }) => {
  await setUp(page, 0)
  await page.goto('/call')
  await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible()
})

test('at 1280px the card offers a QR that decodes to the tel: URL', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await setUp(page, 1)
  await page.goto('/call')
  await page.getByRole('button', { name: 'Show QR for my phone' }).click()

  const png = await page.getByRole('img', { name: /QR code/ }).screenshot()
  const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const decoded = jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height)
  expect(decoded?.data).toBe(`tel:${FIRST_PHONE}`)
})

test.describe('voice notes', () => {
  test('recording creates a voice_note activity with no transcript', async ({ page }) => {
    const { ids, workspaceId } = await setUp(page, 1)
    await page.goto('/call')
    await page.getByRole('button', { name: 'Record voice note' }).click()
    await expect(page.getByRole('button', { name: 'Stop and save' })).toBeVisible()
    await page.waitForTimeout(1_200)
    await page.getByRole('button', { name: 'Stop and save' }).click()
    await expect(page.getByText('Voice note saved')).toBeVisible()

    const activity = await admin().from('activities').select('id, metadata').eq('company_id', ids[0])
      .eq('type', 'voice_note').single()
    expect(activity.data?.metadata).toMatchObject({ storagePath: `${workspaceId}/${activity.data?.id}.webm` })
    const file = await admin().storage.from('voice-notes').download(`${workspaceId}/${activity.data?.id}.webm`)
    expect(file.data?.size).toBeGreaterThan(0)
  })

  test('an unsent note blocks saving the outcome until it is discarded', async ({ page, context }) => {
    await setUp(page, 2)
    await page.goto('/call')
    await page.getByRole('button', { name: 'Record voice note' }).click()
    await page.waitForTimeout(1_200)
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Stop and save' }).click()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()

    await page.getByRole('button', { name: 'Log an outcome' }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: 'Busy', exact: true }).click()
    await expect(sheet.getByRole('button', { name: 'Save outcome' })).toBeDisabled()
    await expect(sheet.getByText('The voice note has not been sent')).toBeVisible()

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Discard note' }).click()
    await expect(sheet.getByRole('button', { name: 'Save outcome' })).toBeEnabled()
    await context.setOffline(false)
  })
})
