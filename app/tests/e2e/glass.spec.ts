import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { deleteUserByEmail, signIn } from './sign-in'

const MOBILE = { width: 390, height: 844 }
const MAX_LIVE_BLUR_ON_MOBILE = 3
const LEVELS = ['L1', 'L2', 'L3'] as const

/**
 * Describes (the start of the HTML of) every matching element whose computed backdrop-filter is not "none".
 * Next's own dev-mode badge blurs itself; it is not ours and does not exist in production, so it is skipped.
 */
async function blurred(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements
      .filter((el) => !el.closest('[data-next-badge]') && getComputedStyle(el).backdropFilter !== 'none')
      .map((el) => el.outerHTML.slice(0, 160)),
  )
}

test.describe('Glass design system', () => {
  let email: string

  test.beforeEach(async ({ page }) => {
    email = `e2e-glass-${randomUUID()}@example.test`
    await signIn(page, email)
  })

  test.afterEach(async () => {
    await deleteUserByEmail(email)
  })

  test('at 390px the page has at most 3 live blur surfaces and the list rows have none', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/glass-fixture?mode=full')
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'full')

    const everything = await blurred(page, '*')
    expect(everything.length).toBeGreaterThan(0) // full mode really blurs; otherwise the next check proves nothing
    expect(everything.length, everything.join(' | ')).toBeLessThanOrEqual(MAX_LIVE_BLUR_ON_MOBILE)

    await expect(page.locator('.glass-row')).toHaveCount(50)
    expect(await blurred(page, '.glass-row')).toEqual([])
  })

  test('lite mode removes every blur but keeps the surfaces', async ({ page }) => {
    await page.goto('/glass-fixture?mode=lite')
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'lite')

    expect(await blurred(page, '*')).toEqual([])
    await expect(page.locator('.glass')).toHaveCount(3)
  })

  test('forced-colors renders solid surfaces', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/glass-fixture')
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'solid')

    expect(await blurred(page, '*')).toEqual([])
    const backgrounds = await page
      .locator('.glass')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).backgroundImage))
    expect(backgrounds).toEqual(['none', 'none', 'none'])
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`baseline screenshots of L1, L2 and L3 in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/glass-fixture?mode=full')
      await expect(page.locator('html')).toHaveAttribute('data-glass', 'full')
      await page.waitForLoadState('networkidle')
      // Next's dev-mode badge sits bottom-left, over the dock; keep it out of the baselines.
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })

      for (const level of LEVELS) {
        await expect(page.locator(`[data-glass-level="${level}"]`)).toHaveScreenshot(`${level}-${scheme}.png`, {
          animations: 'disabled',
          maxDiffPixelRatio: 0.02,
        })
      }
    })
  }
})
