/**
 * The real DNS lookup used by probeSite: every address of a host name, as
 * text. Tests pass a fake Resolver instead, so they never touch the network.
 */
import { lookup } from 'node:dns/promises'
import type { Resolver } from './urlSafety'

export const dnsResolver: Resolver = async (hostname) => {
  const found = await lookup(hostname, { all: true, verbatim: true })
  return found.map((entry) => entry.address)
}
