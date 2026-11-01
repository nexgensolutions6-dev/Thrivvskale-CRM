import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { deleteUserByEmail, signIn } from './sign-in'

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }
const NAV_LABELS = ['Today', 'Call', 'Leads', 'More']

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    inner: window.innerWidth,
  }))
  const message = `scrollWidth ${widths.scroll} vs innerWidth ${widths.inner}`
  expect(widths.scroll, message).toBeLessThanOrEqual(widths.inner)
}

test.describe('PWA files are public', () => {
  // `request` carries no cookies: this is what the browser sees before anyone has signed in.
  for (const path of ['/manifest.webmanifest', '/sw.js', '/offline.html', '/icons/icon-192.png', '/icons/icon-512.png']) {
    test(`${path} loads without signing in`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status()).toBe(200)
    })
  }

  test('the manifest describes an installable app', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json()
    expect(manifest.name).toBe('ThrivvSkale CRM')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/today')
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true)
  })
})

test.describe('App shell', () => {
  let email: string

  test.beforeEach(async ({ page }) => {
    email = `e2e-shell-${randomUUID()}@example.test`
    await signIn(page, email)
  })

  test.afterEach(async () => {
    await deleteUserByEmail(email)
  })

  test('at 1280px the dock is visible, the tab bar is not, and there is one nav landmark', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/today')

    const dock = page.getByTestId('dock')
    await expect(dock).toBeVisible()
    await expect(page.getByTestId('tab-bar')).toBeHidden()
    for (const label of NAV_LABELS) await expect(dock.getByRole('link', { name: label })).toBeVisible()

    await expect(page.getByRole('navigation')).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test('at 390px the tab bar is visible, the dock is not, and there is one nav landmark', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/today')

    const tabBar = page.getByTestId('tab-bar')
    await expect(tabBar).toBeVisible()
    await expect(page.getByTestId('dock')).toBeHidden()
    for (const label of NAV_LABELS) await expect(tabBar.getByRole('link', { name: label })).toBeVisible()

    await expect(page.getByRole('navigation')).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test('the current page is marked in the navigation', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/more/settings')
    await expect(page.getByTestId('dock').getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page')
    const today = page.getByTestId('dock').getByRole('link', { name: 'Today' })
    await expect(today).not.toHaveAttribute('aria-current', 'page')
  })

  for (const [name, size] of [['desktop', DESKTOP], ['mobile', MOBILE]] as const) {
    test(`the stub pages load at ${name} size without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize(size)
      for (const [path, heading] of [['/today', 'Today'], ['/call', 'Call'], ['/leads', 'Leads'], ['/more', 'More']]) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
        await expectNoHorizontalScroll(page)
      }
    })
  }

  test('the menu bar shows quick add, the palette button, targets, sync status and a clock', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/today')

    const bar = page.getByTestId('menu-bar')
    await expect(bar.getByRole('button', { name: 'Quick add' })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Open command palette' })).toBeVisible()
    await expect(bar.getByTestId('targets')).toBeVisible()
    await expect(bar.getByTestId('sync-status')).toBeVisible()
    await expect(bar.locator('time')).toHaveText(/\d{1,2}:\d{2}/)
    // Targets are real now; the sync chip is still a placeholder and says so, in text a screen reader reads.
    await expect(bar.getByTestId('targets')).not.toContainText(/sample/i)
    await expect(bar.getByTestId('sync-status')).toContainText(/sample/i)
  })

  for (const [name, size] of [['phone (390px)', MOBILE], ['desktop (1280px)', DESKTOP]] as const) {
    test(`the sample marker is visible and the sync dot is muted at ${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.goto('/today')
      const bar = page.getByTestId('menu-bar')
      // toBeVisible fails for sr-only text that is merely clipped to 1px, which is the bug this guards.
      const tag = bar.getByTestId('sync-status').getByText('sample', { exact: true })
      await expect(tag).toBeVisible()
      const box = await tag.boundingBox()
      expect(box?.width ?? 0, `sync sample tag width at ${name}`).toBeGreaterThan(20)
      expect(box?.height ?? 0, `sync sample tag height at ${name}`).toBeGreaterThan(8)
      await expect(bar.getByTestId('targets')).not.toContainText(/sample/i)
      await expect(bar.getByTestId('targets')).not.toHaveAttribute('title', /sample/i)
      const sync = bar.getByTestId('sync-status')
      await expect(sync).toHaveAttribute('data-placeholder', 'true')
      // The dot is a hollow ring (transparent fill), never the green "live" dot.
      const dotFill = await sync.locator('[aria-hidden="true"]').evaluate((el) => getComputedStyle(el).backgroundColor)
      expect(dotFill).toBe('rgba(0, 0, 0, 0)')
      // Nothing in the bar may spill past its right edge or overlap the buttons (the bar is fixed, so
      // the page-level scroll check cannot see it).
      const barBox = await bar.boundingBox()
      const clockBox = await bar.locator('time').boundingBox()
      const paletteBox = await bar.getByRole('button', { name: 'Open command palette' }).boundingBox()
      expect((clockBox?.x ?? 0) + (clockBox?.width ?? 0), 'clock right edge').toBeLessThanOrEqual(
        (barBox?.x ?? 0) + (barBox?.width ?? 0),
      )
      const tagBox = await bar.getByTestId('targets').boundingBox()
      expect(tagBox?.x ?? 0, 'targets start after the palette button').toBeGreaterThanOrEqual(
        (paletteBox?.x ?? 0) + (paletteBox?.width ?? 0),
      )
      await expectNoHorizontalScroll(page)
    })
  }

  for (const width of [360, 390]) {
    test(`the menu bar chip stays on one line at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/today')
      const bar = page.getByTestId('menu-bar')
      const chip = bar.getByTestId('targets').locator('xpath=..')
      const box = await chip.boundingBox()
      // h-9 is 36px; a wrapped label would push the chip taller.
      expect(box?.height ?? 0, `chip height at ${width}px`).toBeLessThanOrEqual(36)
      const barBox = await bar.boundingBox()
      expect((box?.x ?? 0) + (box?.width ?? 0), 'chip right edge').toBeLessThanOrEqual(
        (barBox?.x ?? 0) + (barBox?.width ?? 0),
      )
      await expectNoHorizontalScroll(page)
    })
  }

  test('Ctrl+K opens the command palette, typing "leads" and Enter goes to Leads', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/today')
    // The shortcut listener attaches on hydration; a press before that is lost on a cold dev server.
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('Control+k')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()
    const input = palette.getByRole('combobox')
    await expect(input).toBeFocused()

    await input.fill('leads')
    await expect(palette.getByRole('option').first()).toHaveText('Go to Leads')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/leads$/)
    await expect(palette).toBeHidden()
  })

  test('Escape closes the palette and a click on a result runs it', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/today')
    // The shortcut listener attaches on hydration; a press before that is lost on a cold dev server.
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden()

    await page.getByTestId('menu-bar').getByRole('button', { name: 'Open command palette' }).click()
    await page.getByRole('option', { name: 'Open settings' }).click()
    await expect(page).toHaveURL(/\/more\/settings$/)
  })

  test('the manifest is linked and a service worker registers', async ({ page }) => {
    await page.goto('/today')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')

    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.scope
    })
    expect(scope).toMatch(/\/$/)
  })

  test('the service worker caches only static files and shows an offline page without a network', async ({
    page,
    context,
  }) => {
    await page.goto('/today')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // now the page is controlled by the worker, so its fetches go through it
    await page.waitForLoadState('networkidle')

    const cachedPaths = await page.evaluate(async () => {
      const paths: string[] = []
      for (const name of await caches.keys()) {
        const cache = await caches.open(name)
        for (const request of await cache.keys()) paths.push(new URL(request.url).pathname)
      }
      return paths
    })
    expect(cachedPaths).toContain('/offline.html')
    const allowed = /^\/(?:offline\.html|manifest\.webmanifest|icons\/|wallpapers\/|_next\/static\/)/
    expect(cachedPaths.filter((path) => !allowed.test(path)), 'pages or data got cached').toEqual([])

    await context.setOffline(true)
    await page.goto('/leads').catch(() => undefined)
    await expect(page.getByRole('heading', { name: 'You are offline' })).toBeVisible()
    await context.setOffline(false)
  })

  test('Lite glass on the Settings page persists across reloads and sets the glass mode', async ({ page }) => {
    await page.goto('/more/settings')
    const toggle = page.getByRole('checkbox', { name: 'Lite glass' })
    await expect(toggle).toBeVisible()
    await expect(toggle).not.toBeChecked()

    await toggle.check()
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'lite')
    expect(await page.evaluate(() => localStorage.getItem('thrivvskale.glassOverride'))).toBe('lite')

    await page.reload()
    await expect(page.getByRole('checkbox', { name: 'Lite glass' })).toBeChecked()
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'lite')

    await page.getByRole('checkbox', { name: 'Lite glass' }).uncheck()
    expect(await page.evaluate(() => localStorage.getItem('thrivvskale.glassOverride'))).toBeNull()
    await page.reload()
    await expect(page.getByRole('checkbox', { name: 'Lite glass' })).not.toBeChecked()
  })

  test('with storage blocked the Settings page still works for this visit', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('storage blocked')
        },
      })
    })
    await page.goto('/more/settings')
    const toggle = page.getByRole('checkbox', { name: 'Lite glass' })
    await toggle.check()
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'lite')
  })
})
