/**
 * Database checks of the starter content (Task 17): a new workspace gets 6
 * playbooks, 5 objections with English responses and 4 WhatsApp templates;
 * seeding twice adds nothing; a workspace that already existed is not reseeded;
 * and the call screen loader hands the objections and templates to the cockpit.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadCallScreen } from '@/lib/call/loadCallScreen'
import { loadPlaybooks } from '@/lib/content/loadPlaybooks'
import { seedIfNotSeeded } from '@/lib/content/seedIfNotSeeded'
import { seedWorkspaceContent } from '@/lib/content/seedWorkspaceContent'
import { ensureWorkspace } from '@/lib/workspace/ensure-workspace'
import { workspaceIdForUser } from '@/lib/workspace/workspace-id'
import {
  adminClient, cleanup, createUserWithWorkspace, deleteUserAndWorkspaces, exposeStackToApp, localStack,
  type Db, type LocalStack, type TestUser,
} from './support'

const SETUP_TIMEOUT = 120_000

let stack: LocalStack
let admin: Db
const authUserIds: string[] = []
const members: TestUser[] = []

async function newAuthUser(label: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: `pb-${label}-${randomUUID()}@example.test`, password: randomUUID(), email_confirm: true,
  })
  if (created.error) throw created.error
  authUserIds.push(created.data.user.id)
  return created.data.user.id
}

async function marker(workspaceId: string): Promise<string | null> {
  const row = await admin.from('workspaces').select('content_seeded_at').eq('id', workspaceId).single()
  if (row.error) throw row.error
  return row.data.content_seeded_at
}

async function count(table: 'playbooks' | 'objections' | 'content_variants', workspaceId: string, kind?: string) {
  let query = admin.from(table).select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
  if (kind) query = query.eq('kind' as never, kind)
  const result = await query
  if (result.error) throw result.error
  return result.count
}

beforeAll(() => {
  stack = localStack()
  admin = adminClient(stack)
  exposeStackToApp(stack)
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (!admin) return
  for (const userId of authUserIds) await deleteUserAndWorkspaces(stack, userId)
  await cleanup(stack, members)
}, SETUP_TIMEOUT)

describe('starter content', () => {
  it('a newly created workspace gets 6 playbooks, 5 objections and 4 templates', async () => {
    const { workspaceId } = await ensureWorkspace(await newAuthUser('new'))

    expect(await count('playbooks', workspaceId)).toBe(6)
    expect(await count('objections', workspaceId)).toBe(5)
    expect(await count('content_variants', workspaceId, 'template')).toBe(4)
    expect(await count('content_variants', workspaceId, 'objection_response')).toBe(5)
  })

  it('playbooks carry real text and an empty pricing guidance', async () => {
    const { workspaceId } = await ensureWorkspace(await newAuthUser('text'))
    const rows = await admin.from('playbooks').select('*').eq('workspace_id', workspaceId)
    expect(rows.data?.map((row) => row.service_key).sort()).toEqual([
      'ai_website', 'crm_setup', 'lead_capture_tracking', 'seo_digital_marketing',
      'website_whatsapp_integration', 'whatsapp_bots',
    ])
    for (const row of rows.data ?? []) {
      expect(row.pitch.length).toBeGreaterThan(80)
      expect(row.pricing_guidance).toBe('')
      expect(row.discovery_questions).toHaveLength(5)
      expect(row.deliverables).toHaveLength(5)
    }
  })

  it('every objection points at its English response', async () => {
    const { workspaceId } = await ensureWorkspace(await newAuthUser('links'))
    const objections = await admin.from('objections').select('text, suggested_response_id').eq('workspace_id', workspaceId)
    expect(objections.data?.map((row) => row.text).sort()).toEqual([
      'Call back later', 'Not now', 'Send details on WhatsApp', 'Too expensive', 'We already have someone',
    ])
    const ids = (objections.data ?? []).map((row) => row.suggested_response_id as string)
    const responses = await admin.from('content_variants').select('mix, body, kind').in('id', ids)
    expect(responses.data).toHaveLength(5)
    for (const response of responses.data ?? []) {
      expect(response).toMatchObject({ mix: 'en', kind: 'objection_response' })
      expect(response.body.length).toBeGreaterThan(40)
    }
  })

  it('templates use the {name}, {honorific} and {company} placeholders', async () => {
    const { workspaceId } = await ensureWorkspace(await newAuthUser('templates'))
    const rows = await admin.from('content_variants').select('title, body').eq('workspace_id', workspaceId).eq('kind', 'template')
    expect(rows.data?.map((row) => row.title).sort()).toEqual([
      'Brochure and details', 'Demo reminder', 'Thanks after the call', 'Your website is not loading',
    ])
    for (const row of rows.data ?? []) expect(row.body).toContain('{name}')
  })

  it('seeding again adds nothing and keeps edits', async () => {
    const { workspaceId } = await ensureWorkspace(await newAuthUser('twice'))
    await admin.from('playbooks').update({ pitch: 'My own pitch' }).eq('workspace_id', workspaceId).eq('service_key', 'crm_setup')

    await seedWorkspaceContent(workspaceId)
    await seedWorkspaceContent(workspaceId)

    expect(await count('playbooks', workspaceId)).toBe(6)
    expect(await count('objections', workspaceId)).toBe(5)
    expect(await count('content_variants', workspaceId)).toBe(9)
    const edited = await admin.from('playbooks').select('pitch').eq('workspace_id', workspaceId).eq('service_key', 'crm_setup').single()
    expect(edited.data?.pitch).toBe('My own pitch')
  })

  it('concurrent seeding still ends with one copy', async () => {
    const { workspaceId } = await ensureWorkspace(await newAuthUser('race'))
    await Promise.all([seedWorkspaceContent(workspaceId), seedWorkspaceContent(workspaceId), seedWorkspaceContent(workspaceId)])
    expect(await count('objections', workspaceId)).toBe(5)
    expect(await count('content_variants', workspaceId)).toBe(9)
  })

  it('a workspace that already existed is not seeded by ensureWorkspace', async () => {
    const existing = await createUserWithWorkspace(stack, 'pb-existing')
    members.push(existing)

    await ensureWorkspace(existing.userId)

    expect(await count('playbooks', existing.workspaceId)).toBe(0)
    expect(await count('objections', existing.workspaceId)).toBe(0)
  })

  it('seedIfNotSeeded retries an unseeded workspace once and leaves a seeded one alone', async () => {
    const existing = await createUserWithWorkspace(stack, 'pb-retry')
    members.push(existing)
    expect(await count('playbooks', existing.workspaceId)).toBe(0)

    await seedIfNotSeeded(existing.workspaceId)
    expect(await count('playbooks', existing.workspaceId)).toBe(6)
    expect(await count('objections', existing.workspaceId)).toBe(5)

    await admin.from('playbooks').update({ pitch: 'My own pitch' }).eq('workspace_id', existing.workspaceId).eq('service_key', 'crm_setup')
    await seedIfNotSeeded(existing.workspaceId)
    const kept = await admin.from('playbooks').select('pitch').eq('workspace_id', existing.workspaceId).eq('service_key', 'crm_setup').single()
    expect(kept.data?.pitch).toBe('My own pitch')
  })

  it('a healed workspace (created earlier without its owner) is not seeded', async () => {
    const userId = await newAuthUser('heal')
    const workspaceId = workspaceIdForUser(userId)
    await admin.from('workspaces').insert({ id: workspaceId, name: 'Orphan' })

    // The workspace insert loses (it exists), so this call only heals the owner row.
    await ensureWorkspace(userId)

    expect(await count('playbooks', workspaceId)).toBe(0)
    expect(await marker(workspaceId)).not.toBeNull()
    await seedIfNotSeeded(workspaceId)
    expect(await count('playbooks', workspaceId)).toBe(0)
  })

  it('first sign-up seeds once and sets the marker', async () => {
    const userId = await newAuthUser('first')
    const { workspaceId } = await ensureWorkspace(userId)
    expect(await count('playbooks', workspaceId)).toBe(6)
    expect(await marker(workspaceId)).not.toBeNull()
    await seedIfNotSeeded(workspaceId)
    expect(await count('playbooks', workspaceId)).toBe(6)
  })

  it('a user who deleted all playbooks is not re-seeded by the retry', async () => {
    const { workspaceId } = await ensureWorkspace(await newAuthUser('deleted'))
    await admin.from('playbooks').delete().eq('workspace_id', workspaceId)
    await seedIfNotSeeded(workspaceId)
    expect(await count('playbooks', workspaceId)).toBe(0)
  })

  it('a partial seed (marker null, templates missing) is completed and marked', async () => {
    const member = await createUserWithWorkspace(stack, 'pb-partial')
    members.push(member)
    await seedWorkspaceContent(member.workspaceId)
    await admin.from('content_variants').delete().eq('workspace_id', member.workspaceId).eq('kind' as never, 'template')
    await admin.from('workspaces').update({ content_seeded_at: null }).eq('id', member.workspaceId)

    await seedIfNotSeeded(member.workspaceId)

    expect(await count('playbooks', member.workspaceId)).toBe(6)
    expect(await count('content_variants', member.workspaceId)).toBe(9)
    expect(await marker(member.workspaceId)).not.toBeNull()
  })

  it('the signed-in member reads playbooks, and the call screen carries objections and templates', async () => {
    const member = await createUserWithWorkspace(stack, 'pb-reader')
    members.push(member)
    await seedWorkspaceContent(member.workspaceId)

    const playbooks = await loadPlaybooks(member.client, member.workspaceId)
    expect(playbooks.map((playbook) => playbook.title)).toHaveLength(6)
    expect(playbooks[0].discoveryQuestions.length).toBeGreaterThan(0)

    const screen = await loadCallScreen(member.client, member.workspaceId, new Date())
    expect(screen.objections).toHaveLength(5)
    const tooDear = screen.objections.find((objection) => objection.text === 'Too expensive')
    expect(tooDear?.englishId).toBeTruthy()
    expect(tooDear?.responses.map((response) => response.variant.mix)).toEqual([['en']])
    expect(screen.templates.map((template) => template.title).sort()).toHaveLength(4)
  })
})
