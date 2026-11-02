/**
 * Database tests for the privacy actions: setCompanyDnd (drops the company from
 * the ranked queue, logs opted_out / consented), eraseContactData (no number,
 * name or name_latin left; company and anonymised activities kept; logs
 * erased), exportContactData (everything held, logs exported) and
 * setContactPointVisibility, plus readOpenTasks hiding a DND company's
 * tasks, erase never touching audio outside the workspace folder, and the
 * import_cell_has_number matcher. Also checks workspace scoping and input
 * validation. Local Supabase stack only.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadQueueItems } from '@/lib/call/loadQueueItems'
import { eraseContactData } from '@/lib/privacy/eraseContact'
import { exportContactData } from '@/lib/privacy/exportContact'
import { setCompanyDnd } from '@/lib/privacy/setDnd'
import { setContactPointVisibility } from '@/lib/privacy/setPointVisibility'
import { rankQueue } from '@/lib/queue/rank'
import { readOpenTasks } from '@/lib/today/readOpenTasks'
import { adminClient, cleanup, createUserWithWorkspace, localStack, type LocalStack, type TestUser } from './support'

const SETUP_TIMEOUT = 120_000
const NOW = new Date('2026-11-02T05:00:00Z')
let stack: LocalStack
const users: TestUser[] = []

beforeAll(() => {
  stack = localStack()
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (stack) await cleanup(stack, users)
}, SETUP_TIMEOUT)

async function newUser(label: string): Promise<TestUser> {
  const user = await createUserWithWorkspace(stack, label)
  users.push(user)
  return user
}

const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00])

type SeedTable = 'companies' | 'contacts' | 'contact_points' | 'activities' | 'pain_points' | 'import_rows' | 'tasks'

async function insertId(user: TestUser, table: SeedTable, row: object): Promise<string> {
  const result = await user.client.from(table).insert({ workspace_id: user.workspaceId, ...row } as never).select('id').single()
  if (result.error) throw result.error
  return (result.data as { id: string }).id
}

/**
 * A company with one person (two numbers), one company line, a call with a pain
 * point, a note and three import rows: the company's, a skipped row holding the
 * person's second number, and an unrelated row with the same name.
 */
async function seedLead(user: TestUser) {
  const companyId = await insertId(user, 'companies', { name: 'Sai Dental Clinic', base_score: 50 })
  const contactId = await insertId(user, 'contacts', {
    company_id: companyId, name: 'రవి కుమార్', name_latin: 'Ravi Kumar', role: 'owner',
    languages: ['te', 'en'], mix_profile: 'te+en', notes: 'Prefers calls after 6pm',
  })
  const mobileId = await insertId(user, 'contact_points', {
    company_id: companyId, contact_id: contactId, e164: '+919848022338', kind: 'personal',
  })
  const secondId = await insertId(user, 'contact_points', {
    company_id: companyId, contact_id: contactId, e164: '+919848011111', kind: 'business',
  })
  const lineId = await insertId(user, 'contact_points', {
    company_id: companyId, contact_id: null, e164: '+914023456789', kind: 'landline',
  })
  const callActivityId = await insertId(user, 'activities', {
    company_id: companyId, contact_id: contactId, contact_point_id: mobileId, type: 'call',
    body: 'Spoke to Ravi on 98480 22338', metadata: { event: 'call', phone: '+919848022338' },
  })
  const call = await user.client.from('calls').insert({
    workspace_id: user.workspaceId, activity_id: callActivityId, outcome: 'interested', who_answered: 'Ravi',
    lost_reason: 'Ravi says the price is too high',
  })
  if (call.error) throw call.error
  const painPointId = await insertId(user, 'pain_points', {
    company_id: companyId, activity_id: callActivityId, current_tool: 'Ravi paper diary',
    frequency: 'daily', quote: 'Ravi: we lose bookings', quote_en: 'We lose bookings',
  })
  const noteActivityId = await insertId(user, 'activities', {
    company_id: companyId, contact_id: contactId, type: 'note', body: 'Ravi wants a booking page',
  })
  const companyNoteId = await insertId(user, 'activities', {
    company_id: companyId, type: 'note', body: 'Clinic opens at 10',
  })
  const batch = await user.client.from('import_batches')
    .insert({ workspace_id: user.workspaceId, file_name: 'leads.csv', row_count: 1 }).select('id').single()
  if (batch.error) throw batch.error
  const importRow = await user.client.from('import_rows').insert({
    workspace_id: user.workspaceId, batch_id: batch.data.id, row_number: 1, company_id: companyId,
    raw: { Company: 'Sai Dental Clinic', Contact: 'Ravi Kumar', Phone: '98480 22338', Area: 'Ameerpet' },
  })
  if (importRow.error) throw importRow.error
  const skippedRowId = await insertId(user, 'import_rows', {
    batch_id: batch.data.id, row_number: 2, status: 'skipped',
    raw: { Company: 'Sai Dental', Contact: '  ravi   KUMAR ', Phone: '+91 98480 11111', Area: 'Ameerpet' },
  })
  const otherRowId = await insertId(user, 'import_rows', {
    batch_id: batch.data.id, row_number: 3, status: 'skipped',
    raw: { Company: 'Kumar Opticals', Contact: 'Ravi Kumar', Phone: '90000 12345' },
  })
  return {
    companyId, contactId, mobileId, secondId, lineId, callActivityId, noteActivityId, companyNoteId, painPointId,
    batchId: batch.data.id, skippedRowId, otherRowId,
  }
}

async function consentEvents(user: TestUser, companyId: string) {
  const result = await user.client.from('consent_log')
    .select('event, company_id, contact_id, contact_point_id, note').eq('company_id', companyId).order('created_at')
  if (result.error) throw result.error
  return result.data
}

async function rankedIds(user: TestUser): Promise<string[]> {
  const items = await loadQueueItems(user.client, user.workspaceId)
  return rankQueue(items, { now: NOW }).map((item) => item.companyId)
}

describe('setCompanyDnd', () => {
  it('drops the company from the ranked queue and logs opted_out, then consented', async () => {
    const user = await newUser('privacy-dnd')
    const { companyId } = await seedLead(user)
    expect(await rankedIds(user)).toContain(companyId)

    await setCompanyDnd(user.client, user.workspaceId, companyId, true, 'Asked not to be called')
    const loaded = (await loadQueueItems(user.client, user.workspaceId)).find((item) => item.companyId === companyId)
    expect(loaded?.dnd).toBe(true)
    expect(await rankedIds(user)).not.toContain(companyId)

    await setCompanyDnd(user.client, user.workspaceId, companyId, false)
    expect(await rankedIds(user)).toContain(companyId)

    const events = await consentEvents(user, companyId)
    expect(events.map((row) => row.event)).toEqual(['opted_out', 'consented'])
    expect(events[0]).toMatchObject({ company_id: companyId, note: 'Asked not to be called' })
  })
})

describe('consent_log is append-only', () => {
  it('lets a member read and append, but not delete or edit the event', async () => {
    const user = await newUser('privacy-append-only')
    const { companyId } = await seedLead(user)
    await setCompanyDnd(user.client, user.workspaceId, companyId, true, 'Asked not to be called')

    const deleted = await user.client.from('consent_log').delete().eq('company_id', companyId).select('id')
    expect(deleted.error).toBeNull()
    expect(deleted.data).toEqual([])
    expect(await consentEvents(user, companyId)).toHaveLength(1)

    const edited = await user.client.from('consent_log').update({ event: 'consented' }).eq('company_id', companyId)
    expect(edited.error?.message).toContain('[consent_log] update failed: rows are append-only')
    const noted = await user.client.from('consent_log').update({ note: 'rewritten' }).eq('company_id', companyId)
    expect(noted.error?.message).toContain('rows are append-only')
    expect((await consentEvents(user, companyId))[0]).toMatchObject({ event: 'opted_out', note: 'Asked not to be called' })
  })

  it('still lets erase_contact link the log and clear a deleted number', async () => {
    const user = await newUser('privacy-append-erase')
    const lead = await seedLead(user)
    const logged = await user.client.from('consent_log').insert({
      workspace_id: user.workspaceId, contact_point_id: lead.mobileId, event: 'opted_out', note: 'per number',
    })
    expect(logged.error).toBeNull()
    await eraseContactData(user.client, user.workspaceId, lead.contactId)
    const events = await consentEvents(user, lead.companyId)
    expect(events.map((row) => row.event)).toEqual(['opted_out', 'erased'])
    expect(events[0]).toMatchObject({ contact_id: lead.contactId, contact_point_id: null })
  })
})

describe('eraseContactData', () => {
  it('leaves no number, name or name_latin, keeps the company and anonymised activities, logs erased', async () => {
    const user = await newUser('privacy-erase')
    const lead = await seedLead(user)
    const optOut = await user.client.from('consent_log')
      .insert({ workspace_id: user.workspaceId, contact_point_id: lead.mobileId, event: 'opted_out', note: 'per number' })
    if (optOut.error) throw optOut.error
    const voiceId = randomUUID()
    const audioPath = `${user.workspaceId}/${voiceId}.webm`
    const upload = await user.client.storage.from('voice-notes').upload(audioPath, WEBM, { contentType: 'audio/webm' })
    if (upload.error) throw upload.error
    await insertId(user, 'activities', {
      id: voiceId, company_id: lead.companyId, contact_id: lead.contactId, type: 'voice_note',
      body: 'Voice note', metadata: { storagePath: audioPath, sizeBytes: WEBM.length },
    })

    const result = await eraseContactData(user.client, user.workspaceId, lead.contactId)
    expect(result).toEqual({ audioNotRemoved: [] })
    const audio = await adminClient(stack).storage.from('voice-notes').list(user.workspaceId, { limit: 100 })
    expect(audio.data?.map((file) => file.name)).not.toContain(`${voiceId}.webm`)

    const contact = await user.client.from('contacts').select('id').eq('id', lead.contactId)
    expect(contact.data).toEqual([])
    const points = await user.client.from('contact_points').select('id, e164').eq('company_id', lead.companyId)
    expect(points.data).toEqual([{ id: lead.lineId, e164: '+914023456789' }])

    const company = await user.client.from('companies').select('id, name').eq('id', lead.companyId).single()
    expect(company.data?.name).toBe('Sai Dental Clinic')

    const activities = await user.client.from('activities')
      .select('id, type, body, metadata, contact_id, contact_point_id').eq('company_id', lead.companyId)
    const byId = new Map(activities.data?.map((row) => [row.id, row]))
    for (const id of [lead.callActivityId, lead.noteActivityId]) {
      expect(byId.get(id)).toMatchObject({
        body: null, contact_id: null, contact_point_id: null,
        metadata: { erased: true, erasedContactId: lead.contactId },
      })
    }
    expect(byId.get(lead.callActivityId)?.type).toBe('call')
    expect(byId.get(lead.companyNoteId)?.body).toBe('Clinic opens at 10')

    const call = await user.client.from('calls').select('outcome, who_answered, lost_reason')
      .eq('activity_id', lead.callActivityId).single()
    expect(call.data).toEqual({ outcome: 'interested', who_answered: null, lost_reason: null })
    const pain = await user.client.from('pain_points').select('quote, quote_en, current_tool, frequency')
      .eq('id', lead.painPointId).single()
    expect(pain.data).toEqual({ quote: null, quote_en: null, current_tool: null, frequency: null })

    const rows = await user.client.from('import_rows').select('row_number, raw').eq('batch_id', lead.batchId).order('row_number')
    expect(rows.data?.map((row) => row.raw)).toEqual([
      { Company: 'Sai Dental Clinic', Contact: '[erased]', Phone: '[erased]', Area: 'Ameerpet' },
      { Company: 'Sai Dental', Contact: '[erased]', Phone: '[erased]', Area: 'Ameerpet' },
      { Company: 'Kumar Opticals', Contact: 'Ravi Kumar', Phone: '90000 12345' },
    ])

    const events = await consentEvents(user, lead.companyId)
    expect(events).toEqual([
      { event: 'opted_out', company_id: lead.companyId, contact_id: lead.contactId, contact_point_id: null, note: 'per number' },
      { event: 'erased', company_id: lead.companyId, contact_id: lead.contactId, contact_point_id: null, note: null },
    ])
  })
})

describe('eraseContactData audio paths', () => {
  it('never returns or removes a path outside the workspace folder, and reports a file that is not there', async () => {
    const user = await newUser('privacy-audio-own')
    const other = await newUser('privacy-audio-other')
    const admin = adminClient(stack)
    // The eraser also belongs to the other workspace, so the bucket policy alone would allow the delete.
    const joined = await admin.from('members').insert({ workspace_id: other.workspaceId, user_id: user.userId, role: 'owner' })
    if (joined.error) throw joined.error
    const lead = await seedLead(user)
    const foreignPath = `${other.workspaceId}/${randomUUID()}.webm`
    const upload = await other.client.storage.from('voice-notes').upload(foreignPath, WEBM, { contentType: 'audio/webm' })
    if (upload.error) throw upload.error
    const missingPath = `${user.workspaceId}/${randomUUID()}.webm`
    for (const storagePath of [foreignPath, missingPath]) {
      await insertId(user, 'activities', {
        company_id: lead.companyId, contact_id: lead.contactId, type: 'voice_note', metadata: { storagePath },
      })
    }

    const returned = await user.client.rpc('erase_contact', { p_workspace_id: user.workspaceId, p_contact_id: lead.contactId })
    expect(returned.error).toBeNull()
    expect(returned.data).toEqual([missingPath])
    const logged = await user.client.from('consent_log').select('note').eq('contact_id', lead.contactId).eq('event', 'erased').single()
    expect(logged.data?.note).toBe('1 audio path(s) outside the workspace not removed')

    const secondId = await insertId(user, 'contacts', { company_id: lead.companyId, name: 'Second Person' })
    await insertId(user, 'activities', {
      company_id: lead.companyId, contact_id: secondId, type: 'voice_note', metadata: { storagePath: missingPath },
    })
    const result = await eraseContactData(user.client, user.workspaceId, secondId)
    expect(result).toEqual({ audioNotRemoved: [missingPath] })

    const files = await admin.storage.from('voice-notes').list(other.workspaceId, { limit: 100 })
    expect(files.data?.map((file) => `${other.workspaceId}/${file.name}`)).toContain(foreignPath)
    await admin.storage.from('voice-notes').remove([foreignPath])
  })
})

describe('exportContactData', () => {
  it('returns the contact, numbers, activities and notes, and logs exported', async () => {
    const user = await newUser('privacy-export')
    const lead = await seedLead(user)

    const exported = await exportContactData(user.client, user.workspaceId, lead.contactId)
    const text = JSON.stringify(exported)

    expect(exported.contact).toMatchObject({ id: lead.contactId, name: 'రవి కుమార్', name_latin: 'Ravi Kumar', notes: 'Prefers calls after 6pm' })
    expect(exported.contactPoints.map((point) => point.e164).sort()).toEqual(['+919848011111', '+919848022338'])
    expect(exported.activities.map((row) => row.id).sort()).toEqual([lead.callActivityId, lead.noteActivityId].sort())
    expect(text).toContain('Ravi wants a booking page')
    expect(exported.calls).toEqual([expect.objectContaining({ activity_id: lead.callActivityId, who_answered: 'Ravi' })])
    expect(text).not.toContain('+914023456789')
    expect(text).not.toContain('Clinic opens at 10')
    expect(text).not.toContain('Kumar Opticals')
    expect(exported.importCells.map((cell) => [cell.row_number, cell.cell_key, cell.cell_value])).toEqual([
      [1, 'Contact', 'Ravi Kumar'], [1, 'Phone', '98480 22338'],
      [2, 'Contact', '  ravi   KUMAR '], [2, 'Phone', '+91 98480 11111'],
    ])

    const events = await consentEvents(user, lead.companyId)
    expect(events).toEqual([
      { event: 'exported', company_id: lead.companyId, contact_id: lead.contactId, contact_point_id: null, note: null },
    ])
  })
})

describe('readOpenTasks', () => {
  it("hides a DND company's open tasks and shows them again when DND is lifted", async () => {
    const user = await newUser('privacy-tasks')
    const { companyId } = await seedLead(user)
    const taskId = await insertId(user, 'tasks', {
      company_id: companyId, type: 'callback', title: 'Call back', due_at: '2026-11-02T04:00:00Z',
    })
    const openIds = async () => (await readOpenTasks(user.client, user.workspaceId, NOW)).map((task) => task.id)
    expect(await openIds()).toContain(taskId)

    await setCompanyDnd(user.client, user.workspaceId, companyId, true)
    expect(await openIds()).not.toContain(taskId)

    await setCompanyDnd(user.client, user.workspaceId, companyId, false)
    expect(await openIds()).toContain(taskId)
  })
})

describe('readOpenTasks row limit', () => {
  it('applies the 500-row limit after leaving out DND tasks, and keeps tasks with no company', async () => {
    const user = await newUser('privacy-task-limit')
    const { companyId } = await seedLead(user)
    await setCompanyDnd(user.client, user.workspaceId, companyId, true)
    const dndTasks = Array.from({ length: 500 }, (_, index) => ({
      workspace_id: user.workspaceId, company_id: companyId, type: 'callback' as const, title: `DND ${index}`,
      due_at: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
    }))
    const seeded = await user.client.from('tasks').insert(dndTasks)
    if (seeded.error) throw seeded.error
    const callableCompanyId = await insertId(user, 'companies', { name: 'Callable Clinic', base_score: 10 })
    const callableId = await insertId(user, 'tasks', {
      company_id: callableCompanyId, type: 'callback', title: 'Call back', due_at: '2026-11-02T03:00:00Z',
    })
    const looseId = await insertId(user, 'tasks', { company_id: null, type: 'callback', title: 'Loose', due_at: '2026-11-02T03:30:00Z' })

    const tasks = await readOpenTasks(user.client, user.workspaceId, NOW)
    expect(tasks.map((task) => task.id)).toEqual([callableId, looseId])
    expect(tasks[0].companyName).toBe('Callable Clinic')
  })
})

describe('import_cell_has_number', () => {
  const TAILS = ['848022338']
  const cases: [string, boolean][] = [
    ['98480 22338', true],
    ['+91 98480-22338', true],
    ['Phone: (98480) 22338', true],
    ['98480, 22338', false],
    ['98480 / 22338', false],
    ['98480; 22338', false],
    ['98480 or 22338', false],
    ['90000 12345, 98480 22338', true],
    ['98480\u201322338', true], // en dash
    ['98480\u201422338', true], // em dash
    ['98480\u221222338', true], // minus sign
  ]
  let user: TestUser
  beforeAll(async () => {
    user = await newUser('privacy-match')
  }, SETUP_TIMEOUT)

  it.each(cases)('%s -> %s', async (cell, expected) => {
    const result = await user.client.rpc('import_cell_has_number', { p_cell: cell, p_tails: TAILS })
    expect(result.error).toBeNull()
    expect(result.data).toBe(expected)
  })
})

describe('setContactPointVisibility', () => {
  it('sets owner_only and back to workspace', async () => {
    const user = await newUser('privacy-visibility')
    const lead = await seedLead(user)
    await setContactPointVisibility(user.client, user.workspaceId, lead.mobileId, 'owner_only')
    const read = () => user.client.from('contact_points').select('visibility').eq('id', lead.mobileId).single()
    expect((await read()).data?.visibility).toBe('owner_only')
    await setContactPointVisibility(user.client, user.workspaceId, lead.mobileId, 'workspace')
    expect((await read()).data?.visibility).toBe('workspace')
  })
})

describe('workspace scoping and input checks', () => {
  it('refuses records of another workspace and leaves them untouched', async () => {
    const owner = await newUser('privacy-owner')
    const stranger = await newUser('privacy-stranger')
    const lead = await seedLead(owner)

    await expect(setCompanyDnd(stranger.client, stranger.workspaceId, lead.companyId, true)).rejects.toThrow(lead.companyId)
    await expect(setCompanyDnd(stranger.client, owner.workspaceId, lead.companyId, true)).rejects.toThrow('[set_company_dnd]')
    await expect(eraseContactData(stranger.client, stranger.workspaceId, lead.contactId)).rejects.toThrow(lead.contactId)
    await expect(eraseContactData(stranger.client, owner.workspaceId, lead.contactId)).rejects.toThrow('[erase_contact]')
    await expect(exportContactData(stranger.client, stranger.workspaceId, lead.contactId)).rejects.toThrow(lead.contactId)
    await expect(exportContactData(stranger.client, owner.workspaceId, lead.contactId)).rejects.toThrow(lead.contactId)
    const cells = await stranger.client.rpc('contact_import_cells', { p_workspace_id: owner.workspaceId, p_contact_id: lead.contactId })
    expect(cells.error).toMatchObject({ code: '42501', message: expect.stringContaining('[contact_import_cells]') })
    await expect(setContactPointVisibility(stranger.client, stranger.workspaceId, lead.mobileId, 'owner_only')).rejects.toThrow(lead.mobileId)

    const admin = adminClient(stack)
    const company = await admin.from('companies').select('dnd').eq('id', lead.companyId).single()
    expect(company.data?.dnd).toBe(false)
    const contact = await admin.from('contacts').select('name_latin').eq('id', lead.contactId).single()
    expect(contact.data?.name_latin).toBe('Ravi Kumar')
    const point = await admin.from('contact_points').select('visibility').eq('id', lead.mobileId).single()
    expect(point.data?.visibility).toBe('workspace')
    const log = await admin.from('consent_log').select('id').eq('workspace_id', owner.workspaceId)
    expect(log.data).toEqual([])
  })

  it('rejects malformed input before touching the database', async () => {
    const user = await newUser('privacy-input')
    const lead = await seedLead(user)
    const ws = user.workspaceId
    await expect(setCompanyDnd(user.client, ws, 'not-a-uuid', true)).rejects.toThrow('[privacy/validate]')
    await expect(setCompanyDnd(user.client, ws, lead.companyId, 'yes' as unknown as boolean)).rejects.toThrow('dnd')
    await expect(setCompanyDnd(user.client, ws, lead.companyId, true, 42 as unknown as string)).rejects.toThrow('note')
    await expect(eraseContactData(user.client, ws, { id: lead.contactId } as unknown as string)).rejects.toThrow('[privacy/validate]')
    await expect(exportContactData(user.client, ws, '')).rejects.toThrow('[privacy/validate]')
    await expect(setContactPointVisibility(user.client, ws, lead.mobileId, 'public' as never)).rejects.toThrow('visibility')
  })
})
