import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/db/types'
import { approveDraftVariant } from '@/lib/language/approveDraftVariant'
import { createDraft } from '@/lib/language/createDraft'
import { rewriteVariant } from '@/lib/language/rewrite.server'

type Row = Record<string, unknown>

/** Tiny in-memory stand-in for the Supabase query builder (content_variants only). */
function fakeDb(rows: Row[]): SupabaseClient<Database> {
  let nextId = 1
  const from = () => {
    const filters: Array<(row: Row) => boolean> = []
    let patch: Row | null = null
    let inserted: Row | null = null
    let sortKey: string | null = null
    let max = Infinity
    const matching = () => rows.filter((row) => filters.every((test) => test(row)))
    const run = () => {
      if (inserted) return { data: inserted, error: null }
      if (patch) {
        const hit = matching()
        hit.forEach((row) => Object.assign(row, patch))
        return { data: hit, error: null }
      }
      let hit = matching()
      if (sortKey) hit = [...hit].sort((a, b) => String(b[sortKey!]).localeCompare(String(a[sortKey!])))
      return { data: hit.slice(0, max), error: null }
    }
    const query: Record<string, unknown> = {
      select: () => query,
      eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), query),
      in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), query),
      not: (column: string) => (filters.push((row) => row[column] !== null), query),
      order: (column: string) => ((sortKey = column), query),
      limit: (count: number) => ((max = count), query),
      update: (value: Row) => ((patch = value), query),
      insert: (value: Row) => {
        inserted = { id: `new-${nextId++}`, updated_at: `2030-01-0${nextId}`, ...value }
        rows.push(inserted)
        return query
      },
      maybeSingle: async () => ({ data: (run().data as Row[])[0] ?? null, error: null }),
      single: async () => run(),
      then: (resolve: (value: unknown) => unknown) => resolve(run()),
    }
    return query
  }
  return { from } as unknown as SupabaseClient<Database>
}

function mockClient(reply = 'నమస్తే sir, mee website ready') {
  const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: reply }], stop_reason: 'end_turn' })
  return { client: { messages: { create } } as never, create }
}

const INPUT = { text: 'Hello, your website is ready.', mix: ['te', 'en'] as const, script: 'native' as const, register: 'casual' as const }
const WS = 'ws-1'

function englishRow(): Row {
  return { id: 'eng-1', workspace_id: WS, kind: 'opener', vertical: null, stage: null, body: INPUT.text, source: 'manual', mix: 'en', script: 'latin', parent_variant_id: null }
}

describe('rewriteVariant', () => {
  it('sends the English text, target mix/script and examples, and nothing else', async () => {
    const { client, create } = mockClient()
    const examples = [{ from: 'Good morning', to: 'శుభోదయం' }]
    const out = await rewriteVariant({ ...INPUT, mix: [...INPUT.mix], examples }, client)
    expect(out).toBe('నమస్తే sir, mee website ready')
    const sent = JSON.stringify(create.mock.calls[0][0])
    for (const part of [INPUT.text, 'te+en', 'native script', 'casual', 'Good morning', 'శుభోదయం']) {
      expect(sent).toContain(part)
    }
    expect(sent).not.toMatch(/company|contact|phone|\+91/i)
  })

  it('defaults the model to claude-sonnet-5-5 and honours ANTHROPIC_MODEL', async () => {
    const { client, create } = mockClient()
    await rewriteVariant({ ...INPUT, mix: [...INPUT.mix], examples: [] }, client)
    expect(create.mock.calls[0][0].model).toBe('claude-sonnet-5-5')
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-test-model')
    await rewriteVariant({ ...INPUT, mix: [...INPUT.mix], examples: [] }, client)
    expect(create.mock.calls[1][0].model).toBe('claude-test-model')
    vi.unstubAllEnvs()
  })

  it('names the module and step when the reply is empty', async () => {
    const create = vi.fn().mockResolvedValue({ content: [], stop_reason: 'refusal' })
    await expect(rewriteVariant({ ...INPUT, mix: [...INPUT.mix], examples: [] }, { messages: { create } } as never)).rejects.toThrow(
      /\[rewrite\.server\] read reply from claude-sonnet-5-5 failed/,
    )
  })

  it('imports server-only', () => {
    const source = readFileSync('src/lib/language/rewrite.server.ts', 'utf8')
    expect(source).toContain("import 'server-only'")
  })
})

describe('createDraft and approveDraftVariant', () => {
  it('stores an ai_draft with the parent id', async () => {
    const rows = [englishRow()]
    const { client } = mockClient()
    const result = await createDraft(fakeDb(rows), WS, 'eng-1', ['te', 'en'], 'native', 'casual', client)
    const saved = rows.find((row) => row.id === result.variantId)
    expect(saved).toMatchObject({ source: 'ai_draft', parent_variant_id: 'eng-1', mix: 'te+en', script: 'native', kind: 'opener' })
  })

  it('fails with the variant id when the English variant is missing', async () => {
    const { client } = mockClient()
    await expect(createDraft(fakeDb([]), WS, 'nope', ['te'], 'native', 'casual', client)).rejects.toThrow(/\[createDraft\].*nope/)
  })

  it('approving a draft makes it an example in the next call', async () => {
    const rows = [englishRow()]
    const db = fakeDb(rows)
    const first = mockClient()
    const { variantId } = await createDraft(db, WS, 'eng-1', ['te', 'en'], 'native', 'casual', first.client)
    expect(JSON.stringify(first.create.mock.calls[0][0])).not.toContain('Example 1')

    await approveDraftVariant(db, WS, variantId)
    expect(rows.find((row) => row.id === variantId)?.source).toBe('ai_approved')

    const second = mockClient()
    await createDraft(db, WS, 'eng-1', ['te', 'en'], 'native', 'casual', second.client)
    const sent = JSON.stringify(second.create.mock.calls[0][0])
    expect(sent).toContain('Example 1 English: Hello, your website is ready.')
    expect(sent).toContain('నమస్తే sir, mee website ready')
  })

  it('refuses to approve something that is not a draft', async () => {
    await expect(approveDraftVariant(fakeDb([englishRow()]), WS, 'eng-1')).rejects.toThrow(/\[approveDraftVariant\].*eng-1/)
  })
})
