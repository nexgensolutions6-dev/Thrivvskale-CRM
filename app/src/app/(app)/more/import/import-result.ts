/**
 * What the Import screen's server actions hand back to the page: either the
 * counts or a message to show. Shared by actions.ts and import-form.tsx.
 */
import type { ImportReport } from '@/lib/import/importReport'

export type ImportActionResult =
  | { ok: true; rows: number; report: ImportReport }
  | { ok: false; message: string }
