/**
 * Reads every row of a query in pages. PostgREST caps one response (1000 rows
 * by default), so a plain select would silently drop the rest of a large lead
 * list. Called by loadQueueItems.
 */
import { stepError } from '@/lib/step-error'

const PAGE_SIZE = 1000

type Page<T> = { data: T[] | null; error: unknown }

/** `readPage(from, to)` runs the query with `.range(from, to)`; give it a stable `.order()`. */
export async function readAllRows<T>(
  what: string,
  readPage: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const page = await readPage(rows.length, rows.length + PAGE_SIZE - 1)
    if (page.error) throw stepError('readAllRows', `read ${what}`, page.error)
    const data = page.data ?? []
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}
