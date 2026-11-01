'use server'

/**
 * Server actions behind the lead page's PrivacyMenu: setDnd, eraseContact,
 * exportContact and setPointVisibility. Each finds the signed-in user's
 * workspace (login redirect when signed out), then hands the raw input to the
 * src/lib/privacy module, which validates it and scopes every query to that workspace.
 */
import { revalidatePath } from 'next/cache'
import { failureResult, type ActionResult } from '@/lib/leads/actionResult'
import { eraseContactData } from '@/lib/privacy/eraseContact'
import { exportContactData } from '@/lib/privacy/exportContact'
import type { ContactExport } from '@/lib/privacy/readContactExport'
import { setCompanyDnd } from '@/lib/privacy/setDnd'
import { setContactPointVisibility } from '@/lib/privacy/setPointVisibility'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export type ExportResult = { ok: true; data: ContactExport } | { ok: false; message: string }

function refreshLeadPage(): void {
  revalidatePath('/leads/[id]', 'page')
}

export async function setDnd(companyId: unknown, dnd: unknown, note?: unknown): Promise<ActionResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    await setCompanyDnd(db, workspaceId, companyId, dnd, note)
    refreshLeadPage()
    return { ok: true }
  } catch (error) {
    return failureResult('setDnd', error)
  }
}

export async function eraseContact(contactId: unknown): Promise<ActionResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    await eraseContactData(db, workspaceId, contactId)
    refreshLeadPage()
    return { ok: true }
  } catch (error) {
    return failureResult('eraseContact', error)
  }
}

export async function exportContact(contactId: unknown): Promise<ExportResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    return { ok: true, data: await exportContactData(db, workspaceId, contactId) }
  } catch (error) {
    return failureResult('exportContact', error)
  }
}

export async function setPointVisibility(contactPointId: unknown, visibility: unknown): Promise<ActionResult> {
  const { workspaceId } = await getSessionWorkspace()
  try {
    const db = await createSupabaseServerClient()
    await setContactPointVisibility(db, workspaceId, contactPointId, visibility)
    refreshLeadPage()
    return { ok: true }
  } catch (error) {
    return failureResult('setPointVisibility', error)
  }
}
