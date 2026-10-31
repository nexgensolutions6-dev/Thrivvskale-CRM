import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ensureWorkspace } from '@/lib/workspace/ensure-workspace'
import { workspaceIdForUser } from '@/lib/workspace/workspace-id'
import {
  adminClient,
  cleanup,
  createUserWithWorkspace,
  deleteUserAndWorkspaces,
  exposeStackToApp,
  localStack,
  type Db,
  type LocalStack,
  type TestUser,
} from './support'

const SETUP_TIMEOUT = 120_000

let stack: LocalStack
let admin: Db
const createdUserIds: string[] = []
const existingUsers: TestUser[] = []

async function newAuthUser(label: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: `ws-${label}-${randomUUID()}@example.test`,
    password: randomUUID(),
    email_confirm: true,
  })
  if (created.error) throw created.error
  createdUserIds.push(created.data.user.id)
  return created.data.user.id
}

async function membershipsOf(userId: string) {
  const { data, error } = await admin
    .from('members')
    .select('id, workspace_id, role')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

beforeAll(() => {
  stack = localStack()
  admin = adminClient(stack)
  // ensureWorkspace reads its connection from the environment, like the app does.
  exposeStackToApp(stack)
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (!admin) return
  for (const userId of createdUserIds) {
    // A failed test can leave a workspace that has no owner row yet.
    await admin.from('workspaces').delete().eq('id', workspaceIdForUser(userId))
    await deleteUserAndWorkspaces(stack, userId)
  }
  await cleanup(stack, existingUsers)
}, SETUP_TIMEOUT)

describe('ensureWorkspace', () => {
  it('creates a workspace with the India defaults and an owner member', async () => {
    const userId = await newAuthUser('defaults')

    const { workspaceId } = await ensureWorkspace(userId)

    const workspace = await admin
      .from('workspaces')
      .select('home_state, default_language_mix, working_days, timezone')
      .eq('id', workspaceId)
      .single()
    expect(workspace.error).toBeNull()
    expect(workspace.data).toEqual({
      home_state: 'Telangana',
      default_language_mix: ['te', 'hi', 'en'],
      working_days: [1, 2, 3, 4, 5, 6],
      timezone: 'Asia/Kolkata',
    })

    const members = await membershipsOf(userId)
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ workspace_id: workspaceId, role: 'owner' })
  })

  it('is idempotent: calling it twice yields one workspace and one owner row', async () => {
    const userId = await newAuthUser('twice')

    const first = await ensureWorkspace(userId)
    const second = await ensureWorkspace(userId)

    expect(second.workspaceId).toBe(first.workspaceId)
    const members = await membershipsOf(userId)
    expect(members).toHaveLength(1)
    expect(members[0].role).toBe('owner')
    const workspaces = await admin.from('workspaces').select('id').eq('id', first.workspaceId)
    expect(workspaces.data).toHaveLength(1)
  })

  it('is race-safe: parallel calls for one user converge on one workspace and one owner', async () => {
    const userId = await newAuthUser('race')

    const results = await Promise.all(
      Array.from({ length: 8 }, () => ensureWorkspace(userId)),
    )

    const ids = new Set(results.map((r) => r.workspaceId))
    expect(ids.size).toBe(1)
    const members = await membershipsOf(userId)
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ workspace_id: [...ids][0], role: 'owner' })
  })

  it('heals a workspace that was created without its owner row', async () => {
    const userId = await newAuthUser('heal')
    const workspaceId = workspaceIdForUser(userId)
    const orphan = await admin.from('workspaces').insert({ id: workspaceId, name: 'Orphan' })
    expect(orphan.error).toBeNull()

    const result = await ensureWorkspace(userId)

    expect(result.workspaceId).toBe(workspaceId)
    const members = await membershipsOf(userId)
    expect(members).toHaveLength(1)
    expect(members[0].role).toBe('owner')
  })

  it('returns the workspace a user already belongs to instead of creating another', async () => {
    const existing = await createUserWithWorkspace(stack, 'ws-existing')
    existingUsers.push(existing)

    const result = await ensureWorkspace(existing.userId)

    expect(result.workspaceId).toBe(existing.workspaceId)
    const members = await membershipsOf(existing.userId)
    expect(members).toHaveLength(1)
    const stray = await admin
      .from('workspaces')
      .select('id')
      .eq('id', workspaceIdForUser(existing.userId))
    expect(stray.data).toHaveLength(0)
  })

  it('names the module and step when the member row cannot be written', async () => {
    const unknownUserId = randomUUID()

    await expect(ensureWorkspace(unknownUserId)).rejects.toThrow(
      /^\[ensureWorkspace\] insert member failed: /,
    )

    // The workspace row was created first; remove it so the test leaves nothing behind.
    await admin.from('workspaces').delete().eq('id', workspaceIdForUser(unknownUserId))
  })

  it('gives different users different workspaces', async () => {
    const a = await newAuthUser('sep-a')
    const b = await newAuthUser('sep-b')

    const [wa, wb] = await Promise.all([ensureWorkspace(a), ensureWorkspace(b)])

    expect(wa.workspaceId).not.toBe(wb.workspaceId)
    expect((await membershipsOf(a))[0].workspace_id).toBe(wa.workspaceId)
    expect((await membershipsOf(b))[0].workspace_id).toBe(wb.workspaceId)
  })
})
