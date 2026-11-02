/**
 * Shared cockpit steps for call.spec.ts and golden-path.spec.ts: stub the tel: link,
 * fake a return from the dialer, look up a user's workspace. Needs page.clock.install() first.
 */
import type { Page } from '@playwright/test'
import { adminClient, localStack } from '../db/support'

/** The workspace of the user who signed in with `email`. Local stack only. */
export async function workspaceIdOf(email: string): Promise<string> {
  const admin = adminClient(localStack())
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(`[e2e/call-helpers] workspaceIdOf could not list users for ${email}: ${error.message}`)
  const user = data.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`[e2e/call-helpers] workspaceIdOf: no user ${email}`)
  const member = await admin.from('members').select('workspace_id').eq('user_id', user.id).single()
  if (member.error) throw new Error(`[e2e/call-helpers] workspaceIdOf: find workspace of ${email} failed: ${member.error.message}`)
  return member.data.workspace_id
}

/** Stops the tel: link from leaving the page, so the click only starts the "away" timer. */
export async function stubTelLinks(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      if (target.closest('a[href^="tel:"]')) event.preventDefault()
    })
  })
}

/** Presses the Call link, lets `awayMs` pass on the page clock, then fires the "tab is visible again" event. */
export async function pressCallThenReturn(page: Page, awayMs: number): Promise<void> {
  await page.getByRole('link', { name: /^Call / }).click()
  await page.clock.fastForward(awayMs)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}
