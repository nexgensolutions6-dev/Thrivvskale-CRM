import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { adminClient, deleteUserAndWorkspaces, localStack } from '../db/support'
import { waitForMagicLink } from './mailpit'

test('an unauthenticated visit to /leads is redirected to /login', async ({ page }) => {
  await page.goto('/leads')

  await expect(page).toHaveURL(/\/login(\?|$)/)
  await expect(page.getByLabel('Email')).toBeVisible()
})

test('/login renders an email form with an accessible label and button', async ({
  page,
}) => {
  const response = await page.goto('/login')

  expect(response?.status()).toBe(200)
  const email = page.getByLabel('Email')
  await expect(email).toBeVisible()
  await expect(email).toHaveAttribute('type', 'email')
  await expect(email).toHaveAttribute('autocomplete', 'email')
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible()
})

test('/login shows a readable message when the link was invalid', async ({ page }) => {
  await page.goto('/login?error=link_invalid')

  await expect(page.getByRole('alert').filter({ hasText: /sign-in link/i })).toBeVisible()
})

test('a malformed email gets an inline error and sends nothing', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()

  await expect(page.getByRole('alert').filter({ hasText: /valid email/i })).toBeVisible()
})

test('a bad callback code returns to /login on this site, whatever next says', async ({
  page,
}) => {
  await page.goto('/auth/callback?code=not-a-real-code&next=https://evil.example/steal')

  await expect(page).toHaveURL(/^http:\/\/(127\.0\.0\.1|localhost):3100\/login\?error=link_invalid$/)
  await expect(page.getByRole('alert').filter({ hasText: /sign-in link/i })).toBeVisible()
})

test('a callback without a code asks for a new link', async ({ page }) => {
  await page.goto('/auth/callback')

  await expect(page).toHaveURL(/\/login\?error=link_missing$/)
})

async function requestMagicLink(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible()
  return waitForMagicLink(localStack(), email)
}

async function findUserByEmail(email: string) {
  const admin = adminClient(localStack())
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email === email)
}

async function deleteUserByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (user) await deleteUserAndWorkspaces(localStack(), user.id)
}

test.describe('magic link', () => {
  let email: string

  test.beforeEach(() => {
    email = `e2e-${randomUUID()}@example.test`
  })

  test.afterEach(async () => {
    await deleteUserByEmail(email)
  })

  test('signs in, bootstraps the workspace and lands on /today', async ({ page }) => {
    await page.goto('/login')
    const link = await requestMagicLink(page, email)

    await page.goto(link)

    await expect(page).toHaveURL(/\/today$/)

    const user = await findUserByEmail(email)
    expect(user).toBeDefined()
    const admin = adminClient(localStack())
    const members = await admin
      .from('members')
      .select('role, workspaces(home_state, timezone)')
      .eq('user_id', user!.id)
    expect(members.data).toHaveLength(1)
    expect(members.data![0].role).toBe('owner')
    expect(members.data![0].workspaces).toMatchObject({
      home_state: 'Telangana',
      timezone: 'Asia/Kolkata',
    })

    // A signed-in visitor has no business on the login page.
    await page.goto('/login')
    await expect(page).toHaveURL(/\/today$/)
  })

  test('returns to the page that was asked for after signing in', async ({ page }) => {
    await page.goto('/leads?stage=new')
    await expect(page).toHaveURL(/\/login\?next=/)
    const link = await requestMagicLink(page, email)

    await page.goto(link)

    await expect(page).toHaveURL(/\/leads\?stage=new$/)
  })
})
