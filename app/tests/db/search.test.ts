/**
 * Database tests for the search_leads SQL function (migration 0002): finds
 * companies by name, area, tags and contact names (native script through
 * name_latin), forgives typos, and never leaves the caller's workspace.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

async function addCompany(user: TestUser, name: string, extra: { area?: string; tags?: string[] } = {}) {
  const result = await user.client
    .from('companies')
    .insert({ workspace_id: user.workspaceId, name, ...extra })
    .select('id')
    .single()
  if (result.error) throw result.error
  return result.data.id
}

async function addContact(user: TestUser, companyId: string, name: string, nameLatin: string) {
  const result = await user.client
    .from('contacts')
    .insert({ workspace_id: user.workspaceId, company_id: companyId, name, name_latin: nameLatin })
  if (result.error) throw result.error
}

async function search(user: TestUser, q: string, lim?: number, ws = user.workspaceId): Promise<string[]> {
  const args = lim === undefined ? { ws, q } : { ws, q, lim }
  const result = await user.client.rpc('search_leads', args)
  if (result.error) throw result.error
  return result.data.map((row) => row.name)
}

async function seedWorld(user: TestUser) {
  const alpha = await addCompany(user, 'Alpha Foods')
  await addContact(user, alpha, 'రమేష్', 'ramesh')
  const beta = await addCompany(user, 'Beta Textiles')
  await addContact(user, beta, 'रमेश', 'ramesh')
  await addCompany(user, 'Gamma Clinic', { area: 'Peerzadiguda / Uppal / Medipalli' })
  await addCompany(user, 'Delta Works', { area: 'Balanagar', tags: ['Interiors & Modular', 'High intent'] })
}

describe('search_leads', () => {
  it('finds Telugu and Devanagari contacts through name_latin', async () => {
    const user = await newUser('search-latin')
    await seedWorld(user)
    expect((await search(user, 'ramesh')).sort()).toEqual(['Alpha Foods', 'Beta Textiles'])
  })

  it('still finds them with a typo', async () => {
    const user = await newUser('search-typo')
    await seedWorld(user)
    expect((await search(user, 'ramsh')).sort()).toEqual(['Alpha Foods', 'Beta Textiles'])
  })

  it('finds a contact by the native-script name itself', async () => {
    const user = await newUser('search-native')
    await seedWorld(user)
    expect(await search(user, 'రమేష్')).toEqual(['Alpha Foods'])
  })

  it('finds companies by area', async () => {
    const user = await newUser('search-area')
    await seedWorld(user)
    expect(await search(user, 'Uppal')).toEqual(['Gamma Clinic'])
  })

  it('finds companies by name and by tag', async () => {
    const user = await newUser('search-name-tag')
    await seedWorld(user)
    expect(await search(user, 'textiles')).toEqual(['Beta Textiles'])
    expect(await search(user, 'high intent')).toEqual(['Delta Works'])
  })

  it('returns nothing for a blank or unrelated query', async () => {
    const user = await newUser('search-none')
    await seedWorld(user)
    expect(await search(user, '   ')).toEqual([])
    expect(await search(user, 'zzzzqx')).toEqual([])
  })

  it('treats LIKE wildcards in the query as plain text', async () => {
    const user = await newUser('search-wildcard')
    await seedWorld(user)
    expect(await search(user, '%')).toEqual([])
    expect(await search(user, '_')).toEqual([])
  })

  it('honours the limit', async () => {
    const user = await newUser('search-limit')
    await seedWorld(user)
    expect(await search(user, 'ramesh', 1)).toHaveLength(1)
  })

  it('never returns another workspace, even when asked for it by id', async () => {
    const mine = await newUser('search-mine')
    const theirs = await newUser('search-theirs')
    await seedWorld(theirs)
    expect(await search(mine, 'ramesh')).toEqual([])
    expect(await search(mine, 'ramesh', undefined, theirs.workspaceId)).toEqual([])
  })
})
