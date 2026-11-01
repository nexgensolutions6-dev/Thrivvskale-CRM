/**
 * Reads everything held about one person, for a data export: the contact row,
 * their numbers, the activities linked to them or their numbers (calls, notes,
 * WhatsApp), the call and pain-point rows of those activities, and their
 * consent history. Company-level rows are not theirs and are left out.
 * Called by exportContact; uses the user's client, so RLS applies.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'

const MODULE = 'privacy/readContactExport'

type Db = SupabaseClient<Database>
type Tables = Database['public']['Tables']
type Row<T extends keyof Tables> = Tables[T]['Row']

export interface ContactExport {
  exportedAt: string
  contact: Row<'contacts'>
  contactPoints: Row<'contact_points'>[]
  activities: Row<'activities'>[]
  calls: Row<'calls'>[]
  painPoints: Row<'pain_points'>[]
  consentLog: Row<'consent_log'>[]
}

/** PostgREST filter "the person, or one of their numbers". Ids are validated uuids. */
function linkedTo(contactId: string, pointIds: string[]): string {
  const byContact = `contact_id.eq.${contactId}`
  return pointIds.length === 0 ? byContact : `${byContact},contact_point_id.in.(${pointIds.join(',')})`
}

async function readContact(db: Db, workspaceId: string, contactId: string): Promise<Row<'contacts'>> {
  const found = await db.from('contacts').select('*').eq('workspace_id', workspaceId).eq('id', contactId).maybeSingle()
  if (found.error) throw stepError(MODULE, `read contact ${contactId}`, found.error)
  if (!found.data) throw stepError(MODULE, `read contact ${contactId}`, `not found in workspace ${workspaceId}`)
  return found.data
}

async function readPoints(db: Db, workspaceId: string, contactId: string): Promise<Row<'contact_points'>[]> {
  const result = await db.from('contact_points').select('*')
    .eq('workspace_id', workspaceId).eq('contact_id', contactId).order('created_at')
  if (result.error) throw stepError(MODULE, `read numbers of contact ${contactId}`, result.error)
  return result.data
}

async function readActivities(db: Db, workspaceId: string, contactId: string, pointIds: string[]) {
  const result = await db.from('activities').select('*')
    .eq('workspace_id', workspaceId).or(linkedTo(contactId, pointIds)).order('occurred_at')
  if (result.error) throw stepError(MODULE, `read activities of contact ${contactId}`, result.error)
  return result.data
}

async function readCalls(db: Db, workspaceId: string, contactId: string, activityIds: string[]) {
  if (activityIds.length === 0) return []
  const result = await db.from('calls').select('*').eq('workspace_id', workspaceId).in('activity_id', activityIds)
  if (result.error) throw stepError(MODULE, `read calls of contact ${contactId}`, result.error)
  return result.data
}

async function readPainPoints(db: Db, workspaceId: string, contactId: string, activityIds: string[]) {
  if (activityIds.length === 0) return []
  const result = await db.from('pain_points').select('*').eq('workspace_id', workspaceId).in('activity_id', activityIds)
  if (result.error) throw stepError(MODULE, `read pain points of contact ${contactId}`, result.error)
  return result.data
}

async function readConsent(db: Db, workspaceId: string, contactId: string, pointIds: string[]) {
  const result = await db.from('consent_log').select('*')
    .eq('workspace_id', workspaceId).or(linkedTo(contactId, pointIds)).order('at')
  if (result.error) throw stepError(MODULE, `read consent history of contact ${contactId}`, result.error)
  return result.data
}

export async function readContactExport(db: Db, workspaceId: string, contactId: string): Promise<ContactExport> {
  const contact = await readContact(db, workspaceId, contactId)
  const contactPoints = await readPoints(db, workspaceId, contactId)
  const pointIds = contactPoints.map((point) => point.id)
  const activities = await readActivities(db, workspaceId, contactId, pointIds)
  const activityIds = activities.map((activity) => activity.id)
  const [calls, painPoints, consentLog] = await Promise.all([
    readCalls(db, workspaceId, contactId, activityIds),
    readPainPoints(db, workspaceId, contactId, activityIds),
    readConsent(db, workspaceId, contactId, pointIds),
  ])
  return { exportedAt: new Date().toISOString(), contact, contactPoints, activities, calls, painPoints, consentLog }
}
