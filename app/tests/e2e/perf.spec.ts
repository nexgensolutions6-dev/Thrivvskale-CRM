/**
 * Release check (Task 19): on a slow device the lead list still scrolls
 * smoothly. Chromium only. CPU is throttled 4x through the DevTools protocol,
 * the browser reports 1 GB of memory so the glass system picks Lite on its own,
 * the real CSV is imported (297 leads, shown 50 per page), and every page of the
 * list is scrolled top to bottom while frame times are recorded. The median
 * frame must stay under 20 ms. Local stack only.
 */
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { importRealCsv } from './real-csv'
import { deleteUserByEmail, signIn } from './sign-in'

const CPU_SLOWDOWN = 4
const MAX_MEDIAN_FRAME_MS = 20
const PAGE_SIZE = 50
const SCROLL_STEP_PX = 40

/** Scrolls to the bottom one step per frame, inside the page, and returns every frame time in ms. */
async function scrollAndMeasure(page: Page): Promise<number[]> {
  return page.evaluate(
    (step) =>
      new Promise<number[]>((resolve) => {
        const frames: number[] = []
        let last = performance.now()
        function onFrame(now: number) {
          frames.push(now - last)
          last = now
          const root = document.scrollingElement as Element
          const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 1
          if (atBottom) {
            resolve(frames)
            return
          }
          window.scrollBy(0, step)
          requestAnimationFrame(onFrame)
        }
        requestAnimationFrame(onFrame)
      }),
    SCROLL_STEP_PX,
  )
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

test.describe('Lead list performance', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CPU throttling uses the Chromium DevTools protocol')
  let email: string

  test.beforeEach(() => {
    email = `perf-${randomUUID()}@example.test`
  })

  test.afterEach(async () => {
    await deleteUserByEmail(email)
  })

  test('with CPU throttled 4x and Lite glass, scrolling every lead page keeps the median frame under 20 ms', async ({
    page,
    context,
  }) => {
    test.setTimeout(300_000)
    // A low-memory device is one of the rules that picks Lite on its own (src/lib/glass/mode.ts).
    await page.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 1 }))
    await signIn(page, email)
    const inserted = await importRealCsv(page)

    const session = await context.newCDPSession(page)
    await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })

    const frames: number[] = []
    const pages = Math.ceil(inserted / PAGE_SIZE)
    for (let number = 1; number <= pages; number++) {
      await page.goto(`/leads?page=${number}`)
      await expect(page.locator('html')).toHaveAttribute('data-glass', 'lite')
      await expect(page.locator('.glass-row').first()).toBeVisible()
      frames.push(...(await scrollAndMeasure(page)))
    }

    const middle = median(frames)
    console.log(`[perf.spec] ${inserted} leads over ${pages} pages, ${frames.length} frames, median ${middle.toFixed(1)} ms`)
    expect(middle, `median frame time over ${frames.length} frames`).toBeLessThan(MAX_MEDIAN_FRAME_MS)
  })
})
