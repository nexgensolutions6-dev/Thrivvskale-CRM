import { describe, expect, it } from 'vitest'
import { adminClient, assertLocalStack, type LocalStack } from './support'

function stackAt(apiUrl: string, dbUrl: string): LocalStack {
  return {
    apiUrl,
    anonKey: 'anon',
    serviceRoleKey: 'service',
    dbUrl,
    mailUrl: 'http://127.0.0.1:54324',
  }
}

const LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe('local-only guard for the service-role helpers', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321'])(
    'accepts %s',
    (apiUrl) => {
      expect(() => assertLocalStack(stackAt(apiUrl, LOCAL_DB))).not.toThrow()
    },
  )

  it.each([
    'https://abcdefgh.supabase.co',
    'http://192.168.1.20:54321',
    'http://localhost.evil.example:54321',
    'http://127.0.0.1.evil.example',
    'not a url',
  ])('refuses the API url %s', (apiUrl) => {
    expect(() => assertLocalStack(stackAt(apiUrl, LOCAL_DB))).toThrow(/local/i)
  })

  it('refuses a remote database url even when the API url is local', () => {
    const remoteDb = 'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres'
    expect(() => assertLocalStack(stackAt('http://127.0.0.1:54321', remoteDb))).toThrow(
      /local/i,
    )
  })

  it('stops adminClient from being built against a remote project', () => {
    expect(() =>
      adminClient(stackAt('https://abcdefgh.supabase.co', LOCAL_DB)),
    ).toThrow(/local/i)
  })
})
