/**
 * End-to-end checks of the Today screen (Task 16): due callbacks before tasks,
 * "Next up" showing the top queue lead, the Mon-Sat week (grid at 1280px, agenda
 * list at 390px, never a horizontal scrollbar), badges only for due-now and
 * overdue items, the scoreboard and the targets page. Local stack only.
 */
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { kolkataInstant, kolkataYmd } from '../../src/lib/calendar/kolkataDate'
import { weekDays } from '../../src/lib/today/weekDays'
import { adminClient, localStack } from '../db/support'
import { deleteUserByEmail, signIn } from './sign-in'

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }
const HOUR_MS = 3_600_000
const emails: string[] = []

const admin = () => adminClient(localStack())

async function workspaceIdOf(email: string): Promise<string> {
  const users = await admin().auth.admin.listUsers({ perPage: 1000 })
  const user = users.data?.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`[today.spec] no user ${email}`)
  const member = await admin().from('members').select('workspace_id').eq('user_id', user.id).single()
  if (member.error) throw new Error(`[today.spec] find workspace failed: ${member.error.message}`)
  return member.data.workspace_id
}

async function setUp(page: Page): Promise<string> {
  const email = `today-${randomUUID()}@example.test`
  emails.push(email)
  await signIn(page, email)
  return workspaceIdOf(email)
}

async function addLead(workspaceId: string, name: string, priority: 'A' | 'B'): Promise<string> {
  const company = await admin().from('companies')
    .insert({ workspace_id: workspaceId, name, priority, tier: 'core', vertical: 'Coaching & Education' })
    .select('id').single()
  if (company.error) throw new Error(`[today.spec] insert ${name} failed: ${company.error.message}`)
  const point = await admin().from('contact_points')
    .insert({ workspace_id: workspaceId, company_id: company.data.id, kind: 'business',
      e164: `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` })
  if (point.error) throw new Error(`[today.spec] insert number failed: ${point.error.message}`)
  return company.data.id
}

async function addTask(workspaceId: string, companyId: string, type: 'callback' | 'todo', title: string, dueAt: Date) {
  const result = await admin().from('tasks')
    .insert({ workspace_id: workspaceId, company_id: companyId, type, title, due_at: dueAt.toISOString() })
  if (result.error) throw new Error(`[today.spec] insert task failed: ${result.error.message}`)
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    inner: window.innerWidth,
  }))
  expect(widths.scroll, `scrollWidth ${widths.scroll} vs innerWidth ${widths.inner}`).toBeLessThanOrEqual(widths.inner)
}

test.afterEach(async () => {
  while (emails.length > 0) await deleteUserByEmail(emails.pop() as string)
})

test.describe('Today screen', () => {
  test('lists due callbacks first, then tasks, and badges only the due ones', async ({ page }) => {
    const workspaceId = await setUp(page)
    const lead = await addLead(workspaceId, 'Due Lead', 'B')
    const later = await addLead(workspaceId, 'Later Lead', 'B')
    const hourAgo = new Date(Date.now() - HOUR_MS)
    await addTask(workspaceId, lead, 'todo', 'Send the proposal', new Date(Date.now() - 2 * HOUR_MS))
    await addTask(workspaceId, lead, 'callback', 'Call back Due Lead', hourAgo)
    await addTask(workspaceId, later, 'todo', 'Prepare the demo', new Date(Date.now() + 3 * 24 * HOUR_MS))

    await page.goto('/today')
    const rows = page.getByTestId('due-list').getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Call back Due Lead')
    await expect(rows.nth(0)).toHaveAttribute('data-kind', 'callback')
    await expect(rows.nth(1)).toContainText('Send the proposal')
    await expect(rows.nth(1)).toHaveAttribute('data-kind', 'task')
    await expect(page.getByTestId('due-list')).not.toContainText('Prepare the demo')
    await expect(page.getByTestId('due-badge')).toHaveCount(2)
    await expect(page.getByTestId('due-count')).toHaveText('2')
  })

  test('shows no badge when nothing is due now', async ({ page }) => {
    const workspaceId = await setUp(page)
    const lead = await addLead(workspaceId, 'Calm Lead', 'B')
    await addTask(workspaceId, lead, 'todo', 'Prepare the demo', new Date(Date.now() + 3 * 24 * HOUR_MS))

    await page.goto('/today')
    await expect(page.getByTestId('due-list')).toContainText('Nothing is due right now')
    await expect(page.getByTestId('due-badge')).toHaveCount(0)
    await expect(page.getByTestId('due-count')).toHaveCount(0)
  })

  test('Next up shows the top lead of the call queue', async ({ page }) => {
    const workspaceId = await setUp(page)
    await addLead(workspaceId, 'Second Lead', 'B')
    await addLead(workspaceId, 'First Lead', 'A')

    await page.goto('/today')
    const nextUp = page.getByTestId('next-up')
    await expect(nextUp).toContainText('First Lead')
    await expect(nextUp.getByRole('link', { name: /start calling/i })).toHaveAttribute('href', '/call')
  })

  test('Next up says so when the queue is empty', async ({ page }) => {
    await setUp(page)
    await page.goto('/today')
    await expect(page.getByTestId('next-up')).toContainText(/no leads/i)
  })

  test('at 1280px the week is a Mon-Sat grid with no horizontal scrollbar', async ({ page }) => {
    const workspaceId = await setUp(page)
    const lead = await addLead(workspaceId, 'Week Lead', 'B')
    const days = weekDays(kolkataYmd(new Date()))
    await addTask(workspaceId, lead, 'todo', 'Saturday visit', kolkataInstant(days[5], '10:00'))

    await page.setViewportSize(DESKTOP)
    await page.goto('/today')
    const cells = page.getByTestId('week-calendar').getByRole('listitem')
    await expect(cells).toHaveCount(6)
    for (const [index, label] of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].entries()) {
      await expect(cells.nth(index)).toContainText(label)
    }
    await expect(page.getByTestId('week-calendar').locator(`[data-day="${days[5]}"]`)).toContainText('Saturday visit')
    const tops = await cells.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)))
    expect(new Set(tops).size, 'all six days sit on one row').toBe(1)
    await noHorizontalScroll(page)
  })

  test('at 390px the week is an agenda list, one day under another', async ({ page }) => {
    await setUp(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/today')
    const cells = page.getByTestId('week-calendar').getByRole('listitem')
    await expect(cells).toHaveCount(6)
    const lefts = await cells.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().left)))
    expect(new Set(lefts).size, 'days share one left edge').toBe(1)
    const tops = await cells.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)))
    expect(new Set(tops).size, 'days stack vertically').toBe(6)
    await noHorizontalScroll(page)
  })

  test('the scoreboard starts at zero and the page has one level-1 heading', async ({ page }) => {
    await setUp(page)
    await page.goto('/today')
    const board = page.getByTestId('scoreboard')
    for (const metric of ['calls', 'connects', 'conversations', 'demos', 'streak']) {
      await expect(board.getByTestId(`score-${metric}`)).toContainText('0')
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })
})

test.describe('Targets page', () => {
  test('saves targets, which then show on Today and in the menu bar', async ({ page }) => {
    await setUp(page)
    await page.goto('/more/targets')
    await page.getByLabel('Calls per day').fill('25')
    await page.getByLabel('Conversations per day').fill('6')
    await page.getByLabel('Demos per day').fill('1')
    await page.getByRole('button', { name: 'Save targets' }).click()
    await expect(page.getByRole('status')).toContainText('Targets saved')

    await page.goto('/today')
    await expect(page.getByTestId('score-calls')).toContainText('0 / 25')
    const chip = page.getByTestId('menu-bar').getByTestId('targets')
    await expect(chip).toContainText('0/25')
    await expect(chip).not.toContainText(/sample/i)
  })

  test('refuses a bad number with a plain message and keeps the old targets', async ({ page }) => {
    await setUp(page)
    await page.goto('/more/targets')
    await page.getByLabel('Calls per day').fill('20')
    await page.getByLabel('Conversations per day').fill('4')
    await page.getByLabel('Demos per day').fill('1')
    await page.getByRole('button', { name: 'Save targets' }).click()
    await expect(page.getByRole('status')).toContainText('Targets saved')

    await page.getByLabel('Calls per day').fill('-3')
    await page.getByRole('button', { name: 'Save targets' }).click()
    const alert = page.getByRole('alert').filter({ hasText: /calls/i })
    await expect(alert).toContainText(/calls/i)
    await expect(alert).not.toContainText(/violates|constraint|\[|code/i)

    await page.reload()
    await expect(page.getByLabel('Calls per day')).toHaveValue('20')
  })
})
