/**
 * Shared steps for specs that drive the calling cockpit with a stubbed phone:
 * keep the tel: link on the page, then fake a return from the dialer after a
 * chosen time away, plus the workspace lookup. Used by call.spec.ts and golden-path.spec.ts. Needs
 * page.clock.install() to have run first (see call.spec.ts openCockpit).
 */
import type { Page } from '@playwright/test'
import { adminClient, localStack } from '../db/support'

/** The workspace of the user who signed in with `email`. Local stack only. */
export async function workspaceIdOf(email: string): Promise<string> {
  const admin = adminClient(localStack())
  const users = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = users.data?.users.find((candidate) => candidate.email === email)
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
