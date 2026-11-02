'use server'

/**
 * Server actions for the Import screen: preview (what would happen) and
 * confirm (do it). Both follow the same steps: who is signed in, read the
 * uploaded file, hand it to the import code. Called by import-form.tsx.
 */
import type { ImportActionResult } from './import-result'
import { importLeads } from '@/lib/import/importLeads'
import { previewImport } from '@/lib/import/previewImport'
import { readLeadUpload } from '@/lib/import/readLeadUpload'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export async function previewUpload(form: FormData): Promise<ImportActionResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const upload = await readLeadUpload(form)
    const db = await createSupabaseServerClient()
    const report = await previewImport(db, workspaceId, upload.leads)
    return { ok: true, rows: upload.leads.length, report }
  } catch (error) {
    return failure('previewUpload', error)
  }
}

export async function importUpload(form: FormData): Promise<ImportActionResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const upload = await readLeadUpload(form)
    const db = await createSupabaseServerClient()
    const report = await importLeads(db, workspaceId, upload.leads, upload.rawRows, upload.fileName)
    return { ok: true, rows: upload.leads.length, report }
  } catch (error) {
    return failure('importUpload', error)
  }
}

/** The message is already written for people (see readLeadUpload and stepError); log it with the action name. */
function failure(action: string, error: unknown): ImportActionResult {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  console.error(`[${action}] ${message}`, error)
  return { ok: false, message }
}
