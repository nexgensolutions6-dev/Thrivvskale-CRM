/**
 * Says whether an IP address must never be fetched by the server: private,
 * loopback, link-local (cloud metadata is 169.254.169.254), carrier-grade NAT,
 * multicast or otherwise reserved. Pure. Called by urlSafety. Text that is not
 * an IP address counts as blocked (fail closed).
 */

/** [first address as a number, prefix length] for each blocked IPv4 range. */
const BLOCKED_IPV4: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 8], // 0.0.0.0/8 "this network"
  [0x0a000000, 8], // 10.0.0.0/8 private
  [0x64400000, 10], // 100.64.0.0/10 carrier-grade NAT
  [0x7f000000, 8], // 127.0.0.0/8 loopback
  [0xa9fe0000, 16], // 169.254.0.0/16 link-local, includes the metadata address
  [0xac100000, 12], // 172.16.0.0/12 private
  [0xc0000000, 24], // 192.0.0.0/24 protocol assignments
  [0xc0a80000, 16], // 192.168.0.0/16 private
  [0xc6120000, 15], // 198.18.0.0/15 benchmarking
  [0xe0000000, 4], // 224.0.0.0/4 multicast
  [0xf0000000, 4], // 240.0.0.0/4 reserved, includes 255.255.255.255
]

export function isBlockedAddress(address: string): boolean {
  const bare = address.split('%')[0] // drop an IPv6 zone such as "%eth0"
  if (bare.includes(':')) {
    const bytes = parseIpv6(bare)
    return bytes === null || isBlockedIpv6(bytes)
  }
  const octets = parseIpv4(bare)
  return octets === null || isBlockedIpv4(octets)
}

function parseIpv4(text: string): number[] | null {
  const parts = text.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const value = Number(part)
    if (value > 255) return null
    octets.push(value)
  }
  return octets
}

function isBlockedIpv4(octets: number[]): boolean {
  const value = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
  return BLOCKED_IPV4.some(([start, bits]) => {
    const mask = (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) >>> 0 === start
  })
}

/** Sixteen bytes of an IPv6 address, or null when the text is not one. */
function parseIpv6(text: string): number[] | null {
  let work = text
  // A dotted IPv4 tail ("::ffff:1.2.3.4") stands for the last two groups.
  const lastColon = work.lastIndexOf(':')
  if (work.includes('.')) {
    const tail = parseIpv4(work.slice(lastColon + 1))
    if (tail === null) return null
    const high = ((tail[0] << 8) | tail[1]).toString(16)
    const low = ((tail[2] << 8) | tail[3]).toString(16)
    work = `${work.slice(0, lastColon + 1)}${high}:${low}`
  }

  const halves = work.split('::')
  if (halves.length > 2) return null
  const head = halves[0] === '' ? [] : halves[0].split(':')
  const tail = halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  const bytes: number[] = []
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
    const value = parseInt(group, 16)
    bytes.push(value >> 8, value & 0xff)
  }
  return bytes.length === 16 ? bytes : null
}

function isBlockedIpv6(bytes: number[]): boolean {
  const first = (count: number) => bytes.slice(0, count).every((b) => b === 0)
  const embeddedV4 = (from: number) => isBlockedIpv4(bytes.slice(from, from + 4))

  if (first(16)) return true // :: unspecified
  if (first(10) && bytes[10] === 0xff && bytes[11] === 0xff) return embeddedV4(12) // ::ffff:a.b.c.d
  if (first(12)) return embeddedV4(12) // ::a.b.c.d (also ::1)
  // 64:ff9b::/96 NAT64: the last 32 bits are an IPv4 address.
  const isNat64 = bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b
  if (isNat64 && bytes.slice(4, 12).every((b) => b === 0)) return embeddedV4(12)
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return embeddedV4(2) // 2002::/16 6to4
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && bytes[3] === 0) return true // 2001::/32 Teredo
  if ((bytes[0] & 0xfe) === 0xfc) return true // fc00::/7 unique local
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) >= 0x80) return true // fe80::/10 link-local, fec0::/10 site-local
  if (bytes[0] === 0xff) return true // ff00::/8 multicast
  return false
}
