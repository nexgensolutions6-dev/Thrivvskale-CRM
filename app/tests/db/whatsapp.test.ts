import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { confirmWhatsAppForPoint } from '@/lib/whatsapp/confirmWhatsAppForPoint'
import { buildWaLink } from '@/lib/whatsapp/link'
import { cleanup, createUserWithWorkspace, localStack, type LocalStack, type TestUser } from './support'

const SETUP_TIMEOUT = 120_000
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

async function seedPoint(user: TestUser): Promise<{ companyId: string; pointId: string }> {
  const company = await user.client
    .from('companies')
    .insert({ workspace_id: user.workspaceId, name: 'WA Test Co' })
    .select('id')
    .single()
  if (company.error) throw company.error
  const point = await user.client
    .from('contact_points')
    .insert({
      workspace_id: user.workspaceId,
      company_id: company.data.id,
      e164: '+919876543210',
      kind: 'business',
    })
    .select('id')
    .single()
  if (point.error) throw point.error
  return { companyId: company.data.id, pointId: point.data.id }
}

async function readPoint(user: TestUser, pointId: string) {
  const result = await user.client
    .from('contact_points')
    .select('e164, wa_status')
    .eq('id', pointId)
    .single()
  if (result.error) throw result.error
  return result.data
}

describe('confirmWhatsAppForPoint', () => {
  it('sets none, logs an activity, and the point no longer yields a link', async () => {
    const user = await newUser('wa-none')
    const { companyId, pointId } = await seedPoint(user)

    await confirmWhatsAppForPoint(user.client, user.workspaceId, pointId, false)

    const point = await readPoint(user, pointId)
    expect(point.wa_status).toBe('none')
    expect(buildWaLink({ e164: point.e164, waStatus: point.wa_status }, 'hi')).toBeNull()

    const activities = await user.client.from('activities').select('*').eq('contact_point_id', pointId)
    expect(activities.error).toBeNull()
    expect(activities.data).toHaveLength(1)
    expect(activities.data![0]).toMatchObject({
      company_id: companyId,
      workspace_id: user.workspaceId,
      type: 'note',
      metadata: { event: 'whatsapp_confirmation', waStatus: 'none' },
    })
  })

  it('sets verified when the number has WhatsApp', async () => {
    const user = await newUser('wa-verified')
    const { pointId } = await seedPoint(user)
    await confirmWhatsAppForPoint(user.client, user.workspaceId, pointId, true)
    expect((await readPoint(user, pointId)).wa_status).toBe('verified')
  })

  it('names the module, step and point when the point is not found', async () => {
    const user = await newUser('wa-missing')
    const missing = '00000000-0000-4000-8000-000000000000'
    await expect(confirmWhatsAppForPoint(user.client, user.workspaceId, missing, true)).rejects.toThrow(
      /\[confirmWhatsAppForPoint\] find contact point 00000000-0000-4000-8000-000000000000 failed: not found/,
    )
  })

  it("cannot reach another workspace's point", async () => {
    const owner = await newUser('wa-owner')
    const other = await newUser('wa-other')
    const { pointId } = await seedPoint(owner)
    await expect(confirmWhatsAppForPoint(other.client, other.workspaceId, pointId, false)).rejects.toThrow(
      /not found/,
    )
    expect((await readPoint(owner, pointId)).wa_status).toBe('unconfirmed')
  })

  it('rejects a string hasWhatsApp without writing anything', async () => {
    const user = await newUser('wa-badbool')
    const { pointId } = await seedPoint(user)
    await expect(
      confirmWhatsAppForPoint(user.client, user.workspaceId, pointId, 'false' as unknown as boolean),
    ).rejects.toThrow(/\[validateConfirmInput\] validate input/)
    expect((await readPoint(user, pointId)).wa_status).toBe('unconfirmed')
    const activities = await user.client.from('activities').select('id').eq('contact_point_id', pointId)
    expect(activities.data).toHaveLength(0)
  })

  it('rejects a non-uuid contact point id before reaching the database', async () => {
    const user = await newUser('wa-badid')
    await expect(confirmWhatsAppForPoint(user.client, user.workspaceId, 'not-a-uuid', true)).rejects.toThrow(
      /\[validateConfirmInput\] validate input.*"not-a-uuid"/,
    )
  })
})
