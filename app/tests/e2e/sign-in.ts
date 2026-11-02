/**
 * Signs a Playwright page in through the local stack's magic link, and removes
 * the test user afterwards. Local stack only. Used by tests/e2e/glass.spec.ts.
 */
import { expect, type Page } from '@playwright/test'
import { adminClient, deleteUserAndWorkspaces, localStack } from '../db/support'
import { waitForMagicLink } from './mailpit'

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible()
  await page.goto(await waitForMagicLink(localStack(), email))
  await expect(page).toHaveURL(/\/today$/)
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const admin = adminClient(localStack())
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(`[e2e/sign-in] deleteUserByEmail could not list users for ${email}: ${error.message}`)
  const user = data.users.find((candidate) => candidate.email === email)
  if (user) await deleteUserAndWorkspaces(localStack(), user.id)
}
