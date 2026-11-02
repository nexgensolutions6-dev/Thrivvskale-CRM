import { describe, expect, it } from 'vitest'
import { uuidV5, workspaceIdForUser } from '@/lib/workspace/workspace-id'

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidV5', () => {
  it('matches the RFC 4122 known answer for the DNS namespace', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    )
  })
})

describe('workspaceIdForUser', () => {
  const alice = '0b6e6a3e-5f1e-4c64-9a5e-3d2f6a1c9b11'
  const bob = '7d2c1c0e-84d4-4d6e-8d2a-1f0f4e5a6b22'

  it('is a valid version 5 UUID', () => {
    expect(workspaceIdForUser(alice)).toMatch(UUID_V5)
  })

  it('is stable for the same user, whatever the letter case', () => {
    expect(workspaceIdForUser(alice)).toBe(workspaceIdForUser(alice))
    expect(workspaceIdForUser(alice.toUpperCase())).toBe(workspaceIdForUser(alice))
  })

  it('differs between users and never equals the user id', () => {
    expect(workspaceIdForUser(alice)).not.toBe(workspaceIdForUser(bob))
    expect(workspaceIdForUser(alice)).not.toBe(alice)
  })
})
