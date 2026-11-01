/**
 * Database tests for the scoreboard on the local Supabase stack: counts by
 * outcome, Kolkata day boundaries, targets in force on a day, streaks, saving
 * targets with an explicit Kolkata date, and workspace isolation.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Outcome } from '@/lib/domain'
import type { LogCallInput } from '@/lib/call/logCallInput'
import { logCallInWorkspace } from '@/lib/call/logCallInWorkspace'
import { getScoreboard } from '@/lib/scoreboard/getScoreboard'
import { saveTargets } from '@/lib/scoreboard/saveTargets'
import { cleanup, createUserWithWorkspace, localStack, type LocalStack, type TestUser } from './support'

const SETUP_TIMEOUT = 120_000
const DAY1 = '2026-10-29'
const DAY2 = '2026-10-30'
const DAY3 = '2026-10-31'
const DAY4 = '2026-11-01'
const CALLBACK_DUE = '2026-11-03T05:30:00.000Z'
const TARGETS = { calls: '3', conversations: '2', demos: '1' }

let stack: LocalStack
let user: TestUser
let stranger: TestUser
let lead: { companyId: string; pointId: string }
const users: TestUser[] = []

async function addLead(owner: TestUser): Promise<{ companyId: string; pointId: string }> {
  const company = await owner.client.from('companies')
    .insert({ workspace_id: owner.workspaceId, name: `Score Co ${randomUUID()}`, base_score: 50 })
    .select('id').single()
  if (company.error) throw company.error
  const e164 = `+9197${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  const point = await owner.client.from('contact_points')
    .insert({ workspace_id: owner.workspaceId, company_id: company.data.id, kind: 'business', e164 })
    .select('id').single()
  if (point.error) throw point.error
  return { companyId: company.data.id, pointId: point.data.id }
}

beforeAll(async () => {
  stack = localStack()
  user = await createUserWithWorkspace(stack, 'score-a')
  stranger = await createUserWithWorkspace(stack, 'score-b')
  users.push(user, stranger)
  lead = await addLead(user)
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (stack) await cleanup(stack, users)
}, SETUP_TIMEOUT)

async function logAt(occurredAt: string, outcome: Outcome): Promise<void> {
  const input: LogCallInput = {
    clientId: randomUUID(), companyId: lead.companyId, contactPointId: lead.pointId, outcome,
    durationSeconds: 30, durationIsEstimate: false, mixUsed: ['en'], objectionIds: [], occurredAt,
    ...(outcome === 'callback' ? { nextAction: { type: 'callback', dueAt: CALLBACK_DUE } as const } : {}),
  }
  await logCallInWorkspace(user.client, user.workspaceId, input)
}

const score = (owner: TestUser, day: string) => getScoreboard(owner.client, owner.workspaceId, day)

describe('getScoreboard', () => {
  it('is all zero for a workspace with no calls and no targets', async () => {
    expect(await score(stranger, DAY1)).toEqual({
      calls: 0, connects: 0, conversations: 0, demos: 0, streakDays: 0,
      targets: { calls: 0, conversations: 0, demos: 0 },
    })
  })

  it('counts five calls with mixed outcomes and gives a streak of 1 on day one', async () => {
    await saveTargets(user.client, user.workspaceId, TARGETS, new Date('2026-10-28T06:00:00Z'))
    const outcomes: Outcome[] = ['no_answer', 'wrong_number', 'interested', 'callback', 'meeting_booked']
    for (const outcome of outcomes) await logAt(`${DAY1}T05:00:00.000Z`, outcome)

    expect(await score(user, DAY1)).toEqual({
      calls: 5, connects: 3, conversations: 3, demos: 1, streakDays: 1,
      targets: { calls: 3, conversations: 2, demos: 1 },
    })
  })

  it('gives a streak of 2 after a second day meeting the call target', async () => {
    for (let n = 0; n < 3; n++) await logAt(`${DAY2}T06:00:00.000Z`, 'busy')
    expect(await score(user, DAY2)).toMatchObject({ calls: 3, connects: 0, conversations: 0, demos: 0, streakDays: 2 })
  })

  it('keeps the streak while today has no calls yet, then breaks once a whole day is missed', async () => {
    expect((await score(user, DAY3)).streakDays).toBe(2)
    expect((await score(user, DAY4)).streakDays).toBe(0)
  })

  it('files a call under its Kolkata day, not its UTC day', async () => {
    // 19:00 UTC on 31 Oct is 00:30 on 1 Nov in Kolkata.
    await logAt('2026-10-31T19:00:00.000Z', 'no_answer')
    expect((await score(user, DAY3)).calls).toBe(0)
    expect((await score(user, DAY4)).calls).toBe(1)
  })

  it('never shows another workspace the calls of this one', async () => {
    expect((await score(stranger, DAY1)).calls).toBe(0)
  })
})

describe('saveTargets', () => {
  it('writes the Kolkata date, not the UTC date, as effective_from', async () => {
    // 20:00 UTC on 5 Nov is 01:30 on 6 Nov in Kolkata.
    const owner = await createUserWithWorkspace(stack, 'score-c')
    users.push(owner)
    await saveTargets(owner.client, owner.workspaceId, { calls: '10', conversations: '2', demos: '1' },
      new Date('2026-11-05T20:00:00Z'))
    const rows = await owner.client.from('targets').select('effective_from, dials, meetings_booked')
    expect(rows.data).toEqual([{ effective_from: '2026-11-06', dials: 10, meetings_booked: 1 }])
  })

  it('updates the same day instead of adding a second row', async () => {
    const owner = users[users.length - 1]
    await saveTargets(owner.client, owner.workspaceId, { calls: '12', conversations: '3', demos: '2' },
      new Date('2026-11-05T21:00:00Z'))
    const rows = await owner.client.from('targets').select('dials, conversations, meetings_booked')
    expect(rows.data).toEqual([{ dials: 12, conversations: 3, meetings_booked: 2 }])
  })

  it('refuses invalid values before touching the database', async () => {
    await expect(saveTargets(user.client, user.workspaceId, { calls: '-4', conversations: '1', demos: '1' }, new Date()))
      .rejects.toThrow(/calls/i)
  })
})
