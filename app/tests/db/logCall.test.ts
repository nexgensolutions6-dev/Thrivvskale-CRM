/**
 * Database tests for call logging and voice notes on the local Supabase stack:
 * one call/activity/task per clientId even under concurrent submissions, no
 * half-written call on failure, queue effects of an outcome, verbatim pain
 * quotes, the contact's mix following nextMixProfile, ownership checks across
 * companies and workspaces, and the private voice-notes bucket.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { LogCallInput } from '@/lib/call/logCallInput'
import { logCallInWorkspace } from '@/lib/call/logCallInWorkspace'
import { refusalReason } from '@/lib/call/logCallRefusal'
import { loadCallScreen } from '@/lib/call/loadCallScreen'
import { loadQueueItems } from '@/lib/call/loadQueueItems'
import { saveVoiceNote } from '@/lib/call/saveVoiceNote'
import { rankQueue } from '@/lib/queue/rank'
import { adminClient, cleanup, createUserWithWorkspace, localStack, type LocalStack, type TestUser } from './support'

const SETUP_TIMEOUT = 120_000
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03])
const DUE_AT = '2026-11-03T05:30:00.000Z'
const NOW = new Date('2026-11-01T06:00:00.000Z')

let stack: LocalStack
let user: TestUser
let stranger: TestUser
const users: TestUser[] = []

beforeAll(async () => {
  stack = localStack()
  user = await createUserWithWorkspace(stack, 'call-a')
  stranger = await createUserWithWorkspace(stack, 'call-b')
  users.push(user, stranger)
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (stack) await cleanup(stack, users)
}, SETUP_TIMEOUT)

interface Lead {
  companyId: string
  contactId: string
  pointId: string
}

async function addLead(owner: TestUser, name: string, mix = 'te+en'): Promise<Lead> {
  const company = await owner.client.from('companies')
    .insert({ workspace_id: owner.workspaceId, name, base_score: 50, tier: 'core', priority: 'A' })
    .select('id').single()
  if (company.error) throw company.error
  const contact = await owner.client.from('contacts')
    .insert({ workspace_id: owner.workspaceId, company_id: company.data.id, name: 'Ramesh', role: 'owner',
      mix_profile: mix })
    .select('id').single()
  if (contact.error) throw contact.error
  const e164 = `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  const point = await owner.client.from('contact_points')
    .insert({ workspace_id: owner.workspaceId, company_id: company.data.id, contact_id: contact.data.id, e164,
      kind: 'business' })
    .select('id').single()
  if (point.error) throw point.error
  return { companyId: company.data.id, contactId: contact.data.id, pointId: point.data.id }
}

function callInput(lead: Lead, extra: Partial<LogCallInput> = {}): LogCallInput {
  return {
    clientId: randomUUID(),
    companyId: lead.companyId,
    contactPointId: lead.pointId,
    outcome: 'no_answer',
    durationSeconds: 60,
    durationIsEstimate: true,
    mixUsed: ['te', 'en'],
    objectionIds: [],
    ...extra,
  }
}

async function counts(owner: TestUser, lead: Lead) {
  const db = owner.client
  const activities = await db.from('activities').select('id').eq('company_id', lead.companyId)
  const ids = (activities.data ?? []).map((row) => row.id)
  const calls = await db.from('calls').select('id').in('activity_id', ids)
  const tasks = await db.from('tasks').select('id').eq('company_id', lead.companyId)
  return { activities: ids.length, calls: calls.data?.length ?? 0, tasks: tasks.data?.length ?? 0 }
}

const log = (input: LogCallInput) => logCallInWorkspace(user.client, user.workspaceId, input)
const callback = { type: 'callback', dueAt: DUE_AT } as const

describe('logCallInWorkspace', () => {
  it('creates one call, one activity and one task for a callback', async () => {
    const lead = await addLead(user, 'One Row Co')
    const result = await log(callInput(lead, { outcome: 'callback', nextAction: callback }))

    expect(result.duplicate).toBe(false)
    expect(await counts(user, lead)).toEqual({ activities: 1, calls: 1, tasks: 1 })

    const task = await user.client.from('tasks').select('*').eq('company_id', lead.companyId).single()
    expect(task.data).toMatchObject({ type: 'callback', done_at: null })
    expect(new Date(task.data?.due_at ?? '').toISOString()).toBe(DUE_AT)
    expect(task.data?.title).toContain('One Row Co')

    const company = await user.client.from('companies').select('*').eq('id', lead.companyId).single()
    expect(company.data?.last_contacted_at).not.toBeNull()
    expect(new Date(company.data?.next_action_at ?? '').toISOString()).toBe(DUE_AT)

    const call = await user.client.from('calls').select('*').eq('id', result.callId).single()
    expect(call.data).toMatchObject({ outcome: 'callback', duration_seconds: 60, duration_is_estimate: true })
  })

  it('returns duplicate:true for the same clientId and adds nothing', async () => {
    const lead = await addLead(user, 'Retry Co')
    const input = callInput(lead, { outcome: 'callback', nextAction: callback })
    const first = await log(input)
    const second = await log(input)

    expect(second).toEqual({ callId: first.callId, duplicate: true })
    expect(await counts(user, lead)).toEqual({ activities: 1, calls: 1, tasks: 1 })
  })

  it('makes one call out of concurrent submissions of one clientId', async () => {
    const lead = await addLead(user, 'Race Co')
    const input = callInput(lead, { outcome: 'callback', nextAction: callback })
    const results = await Promise.all([log(input), log(input), log(input), log(input)])

    expect(new Set(results.map((result) => result.callId)).size).toBe(1)
    expect(results.filter((result) => !result.duplicate)).toHaveLength(1)
    expect(await counts(user, lead)).toEqual({ activities: 1, calls: 1, tasks: 1 })
  })

  it('writes nothing at all when a later step of the transaction fails', async () => {
    const lead = await addLead(user, 'Rollback Co')
    const painPoint = { processCategory: 'reporting', impact: 'time', severity: 3 } as const
    const input = callInput(lead, { outcome: 'callback', nextAction: callback, painPoint })
    // The opener check runs after the activity insert: a foreign opener must undo that insert.
    await expect(log({ ...input, openerId: randomUUID() })).rejects.toThrow(/opener/)
    expect(await counts(user, lead)).toEqual({ activities: 0, calls: 0, tasks: 0 })
    const pains = await user.client.from('pain_points').select('id').eq('company_id', lead.companyId)
    expect(pains.data).toEqual([])
  })

  it('leaves a wrong_number company out of the queue', async () => {
    const lead = await addLead(user, 'Wrong Number Co')
    await log(callInput(lead, { outcome: 'wrong_number' }))

    const company = await user.client.from('companies').select('wrong_number').eq('id', lead.companyId).single()
    expect(company.data?.wrong_number).toBe(true)
    const ranked = rankQueue(await loadQueueItems(user.client, user.workspaceId), { now: NOW })
    expect(ranked.map((item) => item.companyId)).not.toContain(lead.companyId)
  })

  it('raises the dynamic score after an interested outcome', async () => {
    const lead = await addLead(user, 'Interested Co')
    const scoreOf = async () => {
      const items = await loadQueueItems(user.client, user.workspaceId)
      return items.find((item) => item.companyId === lead.companyId)?.score
    }
    expect(await scoreOf()).toBe(50)
    await log(callInput(lead, { outcome: 'interested', nextAction: callback }))
    expect(await scoreOf()).toBeGreaterThan(50)
  })

  it('stores a pain point with its quote verbatim, linked to the call activity', async () => {
    const lead = await addLead(user, 'Pain Co')
    const quote = 'Sir, follow-up చేయడం చాలా కష్టం, register లో రాస్తాం'
    await log(callInput(lead, {
      outcome: 'interested',
      nextAction: callback,
      painPoint: { processCategory: 'follow-ups', currentTool: 'paper register', impact: 'time', severity: 4, quote },
    }))
    const pain = await user.client.from('pain_points').select('*').eq('company_id', lead.companyId).single()
    expect(pain.data).toMatchObject({
      quote, process_category: 'follow-ups', current_tool: 'paper register', impact_type: 'time', severity: 4,
    })
    expect(pain.data?.activity_id).not.toBeNull()
  })

  it('moves the contact to the most-spoken of the last three mixes', async () => {
    const lead = await addLead(user, 'Mix Co', 'te+en')
    const mixOf = async () => {
      const row = await user.client.from('contacts').select('mix_profile').eq('id', lead.contactId).single()
      return row.data?.mix_profile
    }
    const spoke = (mixUsed: LogCallInput['mixUsed']) =>
      log(callInput(lead, { outcome: 'interested', mixUsed, nextAction: callback }))

    await spoke(['te', 'en'])
    expect(await mixOf()).toBe('te+en')
    await spoke(['hi', 'en'])
    await spoke(['hi', 'en'])
    expect(await mixOf()).toBe('hi+en')
  })

  it('does not learn a mix from an unanswered call', async () => {
    const lead = await addLead(user, 'Silent Co', 'te+en')
    await log(callInput(lead, { outcome: 'no_answer', mixUsed: ['hi'] }))
    const row = await user.client.from('contacts').select('mix_profile').eq('id', lead.contactId).single()
    expect(row.data?.mix_profile).toBe('te+en')
  })

  it('closes the open callback it fulfils, so the lead stops being due', async () => {
    const lead = await addLead(user, 'Follow Up Co')
    await log(callInput(lead, { outcome: 'callback', nextAction: callback }))
    await log(callInput(lead, { outcome: 'not_interested', lostReason: 'Already has software' }))

    const tasks = await user.client.from('tasks').select('done_at').eq('company_id', lead.companyId)
    expect(tasks.data?.every((task) => task.done_at !== null)).toBe(true)
    const company = await user.client.from('companies').select('next_action_at').eq('id', lead.companyId).single()
    expect(company.data?.next_action_at).toBeNull()
    const items = await loadQueueItems(user.client, user.workspaceId)
    expect(items.map((item) => item.companyId)).not.toContain(lead.companyId)
  })

  it('stamps a queued call with the time it happened', async () => {
    const lead = await addLead(user, 'Offline Time Co')
    const occurredAt = '2026-10-30T06:00:00.000Z'
    await log(callInput(lead, { occurredAt }))
    const activity = await user.client.from('activities').select('occurred_at').eq('company_id', lead.companyId).single()
    expect(new Date(activity.data?.occurred_at ?? '').toISOString()).toBe(occurredAt)
  })

  it('refuses a number that belongs to another company', async () => {
    const lead = await addLead(user, 'Own Co')
    const other = await addLead(user, 'Other Co')
    await expect(log(callInput(lead, { contactPointId: other.pointId }))).rejects.toThrow(/Own Co|contact point/)
    expect(await counts(user, lead)).toEqual({ activities: 0, calls: 0, tasks: 0 })
  })

  it("refuses another workspace's company, opener and objection", async () => {
    const lead = await addLead(user, 'Mine Co')
    const theirs = await addLead(stranger, 'Their Co')
    await expect(log(callInput(theirs))).rejects.toThrow(/not found/)

    const opener = await stranger.client.from('content_variants')
      .insert({ workspace_id: stranger.workspaceId, kind: 'opener', body: 'Hello' }).select('id').single()
    await expect(log(callInput(lead, { openerId: opener.data?.id }))).rejects.toThrow(/opener/)

    const objection = await stranger.client.from('objections')
      .insert({ workspace_id: stranger.workspaceId, text: 'Too costly' }).select('id').single()
    await expect(log(callInput(lead, { objectionIds: [objection.data?.id ?? ''] }))).rejects.toThrow(/objection/)
    expect(await counts(user, lead)).toEqual({ activities: 0, calls: 0, tasks: 0 })
  })

  it("refuses another company's own opener", async () => {
    const lead = await addLead(user, 'Opener Co')
    const other = await addLead(user, 'Opener Owner Co')
    const opener = await user.client.from('content_variants')
      .insert({ workspace_id: user.workspaceId, kind: 'opener', body: 'Hi', company_id: other.companyId })
      .select('id').single()
    await expect(log(callInput(lead, { openerId: opener.data?.id }))).rejects.toThrow(/opener/)
  })

  it('classes real ownership failures as refusals, naming the check', async () => {
    const lead = await addLead(user, 'Refused Co')
    const other = await addLead(user, 'Other Refused Co')
    const theirs = await addLead(stranger, 'Stranger Refused Co')
    const reasonOf = (input: LogCallInput) => log(input).then(() => null, refusalReason)

    expect(await reasonOf(callInput(lead, { contactPointId: other.pointId }))).toMatch(/Refused Co/)
    expect(await reasonOf(callInput(lead, { openerId: randomUUID() }))).toMatch(/\[log_call\] check opener/)
    expect(await reasonOf(callInput(theirs))).toMatch(/not found/)
    expect(await reasonOf({ ...callInput(lead), durationSeconds: -1 })).toMatch(/durationSeconds/)
  })

  it('blocks the database function for a workspace the caller is not in', async () => {
    const lead = await addLead(stranger, 'Direct Co')
    const rpc = await user.client.rpc('log_call', {
      p_workspace_id: stranger.workspaceId,
      p_client_id: randomUUID(),
      p_company_id: lead.companyId,
      p_contact_point_id: lead.pointId,
      p_outcome: 'busy',
      p_duration_is_estimate: false,
    })
    expect(rpc.error?.message).toMatch(/log_call/)
    expect(await counts(stranger, lead)).toEqual({ activities: 0, calls: 0, tasks: 0 })
  })
})

describe('loadCallScreen', () => {
  it('shows the company opener first, ranks due leads, and holds a future callback back', async () => {
    const owner = await createUserWithWorkspace(stack, 'call-screen')
    users.push(owner)
    const first = await addLead(owner, 'Top Co', 'te+en')
    const second = await addLead(owner, 'Later Co', 'te+en')
    const own = await owner.client.from('content_variants').insert({
      workspace_id: owner.workspaceId, kind: 'opener', body: 'Own opener for Top Co', company_id: first.companyId,
    }).select('id').single()
    await owner.client.from('content_variants').insert({
      workspace_id: owner.workspaceId, kind: 'opener', body: 'Secret of Later Co', company_id: second.companyId,
    })
    await owner.client.from('content_variants').insert({
      workspace_id: owner.workspaceId, kind: 'opener', body: 'Generic English', mix: 'en',
    })
    await owner.client.from('companies').update({ priority: 'B' }).eq('id', second.companyId)

    const screen = await loadCallScreen(owner.client, owner.workspaceId, NOW)
    expect(screen.leads.map((lead) => lead.companyId)).toEqual([first.companyId, second.companyId])
    const top = screen.leads[0]
    expect(top.openers[0].id).toBe(own.data?.id)
    expect(top.openers.map((opener) => opener.text)).not.toContain('Secret of Later Co')
    expect(top.points[0]).toMatchObject({ id: first.pointId, mix: ['te', 'en'] })
    expect(new Date(top.callbackDefault).getTime()).toBeGreaterThan(NOW.getTime())

    await logCallInWorkspace(owner.client, owner.workspaceId, callInput(first, { nextAction: callback }))
    const after = await loadCallScreen(owner.client, owner.workspaceId, NOW)
    expect(after.leads.map((lead) => lead.companyId)).toEqual([second.companyId])
    expect(after.scheduledLater).toBe(1)
  })
})

describe('saveVoiceNote', () => {
  it('stores the audio and adds a voice_note activity with no transcript', async () => {
    const lead = await addLead(user, 'Voice Co')
    const audio = new Blob([WEBM], { type: 'audio/webm;codecs=opus' })
    const { activityId } = await saveVoiceNote(user.client, user.workspaceId, lead.companyId, audio)

    const activity = await user.client.from('activities').select('*').eq('id', activityId).single()
    expect(activity.data).toMatchObject({ type: 'voice_note', company_id: lead.companyId })
    const path = `${user.workspaceId}/${activityId}.webm`
    expect(activity.data?.metadata).toMatchObject({ storagePath: path })
    expect(activity.data?.metadata).not.toHaveProperty('transcript')

    const mine = await user.client.storage.from('voice-notes').download(path)
    expect(mine.error).toBeNull()
    expect(mine.data?.size).toBe(WEBM.length)

    const theirs = await stranger.client.storage.from('voice-notes').download(path)
    expect(theirs.data).toBeNull()
  })

  it('refuses a company of another workspace and leaves no file behind', async () => {
    const theirs = await addLead(stranger, 'Foreign Voice Co')
    const audio = new Blob([WEBM], { type: 'audio/webm' })
    await expect(saveVoiceNote(user.client, user.workspaceId, theirs.companyId, audio)).rejects.toThrow(/not found/)
    const listed = await adminClient(stack).storage.from('voice-notes').list(user.workspaceId, { limit: 100 })
    const stored = await user.client.from('activities').select('id').eq('type', 'voice_note')
    expect(listed.data?.length).toBe(stored.data?.length)
  })

  it("blocks writing into another workspace's folder", async () => {
    const audio = new Blob([WEBM], { type: 'audio/webm' })
    const path = `${stranger.workspaceId}/${randomUUID()}.webm`
    const upload = await user.client.storage.from('voice-notes').upload(path, audio, { contentType: 'audio/webm' })
    expect(upload.error).not.toBeNull()
  })

  it('refuses a folder that is not a uuid without a server error', async () => {
    const audio = new Blob([WEBM], { type: 'audio/webm' })
    const upload = await user.client.storage.from('voice-notes')
      .upload('not-a-uuid/x.webm', audio, { contentType: 'audio/webm' })
    expect(upload.error?.message).toMatch(/row-level security/i)
  })
})
