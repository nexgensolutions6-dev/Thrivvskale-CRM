/**
 * `saveContact`: creates a contact (or edits one when contactId is given)
 * for a lead, with its name_latin, role and language mix, and adds the
 * phone number as a contact point when one is given. Input is validated at
 * runtime first. Uses the signed-in user's client. Called by the saveContact
 * server action (the contact form).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { toMixText } from '@/lib/language/mixText'
import { requireCompany } from './requireCompany'
import { validateContactInput, type ValidContactInput } from './validateContactInput'

const MODULE = 'saveContact'

type Db = SupabaseClient<Database>

export async function saveContact(
  db: Db,
  workspaceId: string,
  input: unknown,
): Promise<{ contactId: string }> {
  const valid = validateContactInput(input)
  const company = await requireCompany(db, MODULE, workspaceId, valid.companyId)

  const contactId = valid.contactId
    ? await updateContact(db, workspaceId, valid, valid.contactId)
    : await insertContact(db, workspaceId, valid, company.name)

  if (valid.phone) {
    try {
      await addPhoneIfNew(db, workspaceId, valid, contactId)
    } catch (error) {
      if (!valid.contactId) await removeNewContact(db, workspaceId, contactId)
      throw stepError(MODULE, `save phone for "${company.name}"`, error)
    }
  }
  return { contactId }
}

function contactColumns(valid: ValidContactInput) {
  return {
    name: valid.name,
    name_latin: valid.nameLatin,
    role: valid.role,
    languages: valid.mix,
    mix_profile: valid.mix.length > 0 ? toMixText(valid.mix) : null,
    notes: valid.notes,
  }
}

async function insertContact(db: Db, workspaceId: string, valid: ValidContactInput, companyName: string) {
  const inserted = await db
    .from('contacts')
    .insert({ workspace_id: workspaceId, company_id: valid.companyId, ...contactColumns(valid) })
    .select('id')
    .single()
  if (inserted.error) throw stepError(MODULE, `create contact for "${companyName}"`, inserted.error)
  return inserted.data.id
}

async function updateContact(db: Db, workspaceId: string, valid: ValidContactInput, contactId: string) {
  const updated = await db
    .from('contacts')
    .update(contactColumns(valid))
    .eq('workspace_id', workspaceId)
    .eq('company_id', valid.companyId)
    .eq('id', contactId)
    .select('id')
  if (updated.error) throw stepError(MODULE, `update contact ${contactId}`, updated.error)
  if (updated.data.length === 0) {
    throw stepError(MODULE, `find contact ${contactId}`, `not found in company ${valid.companyId}`)
  }
  return contactId
}

/** The same number is not added twice to one contact. */
async function addPhoneIfNew(db: Db, workspaceId: string, valid: ValidContactInput, contactId: string) {
  const phone = valid.phone
  if (!phone) return
  const existing = await db
    .from('contact_points')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .eq('e164', phone.e164)
  if (existing.error) throw existing.error
  if (existing.data.length > 0) return

  const isLandline = phone.kind === 'landline'
  const inserted = await db.from('contact_points').insert({
    workspace_id: workspaceId,
    company_id: valid.companyId,
    contact_id: contactId,
    e164: phone.e164,
    kind: isLandline ? 'landline' : 'business',
    wa_status: isLandline ? 'landline' : 'unconfirmed',
  })
  if (inserted.error) throw inserted.error
}

/** Undo the contact created a moment ago, so a failed phone save leaves nothing half-saved. */
async function removeNewContact(db: Db, workspaceId: string, contactId: string): Promise<void> {
  const removed = await db.from('contacts').delete().eq('workspace_id', workspaceId).eq('id', contactId)
  if (removed.error) console.error(`[${MODULE}] could not undo new contact ${contactId}:`, removed.error)
}
