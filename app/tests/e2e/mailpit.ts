/**
 * Reads sign-in emails from the local Supabase stack's Mailpit inbox
 * (http://127.0.0.1:54324 by default). Local stack only.
 */
import type { LocalStack } from '../db/support'

interface MailpitSearch {
  messages: { ID: string }[]
}

interface MailpitMessage {
  Text: string
}

const POLL_INTERVAL_MS = 250
const POLL_TIMEOUT_MS = 20_000

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Mailpit ${url} responded ${response.status}`)
  return (await response.json()) as T
}

/** Waits for a magic-link email to `address` and returns the verify link inside it. */
export async function waitForMagicLink(
  stack: LocalStack,
  address: string,
): Promise<string> {
  const base = stack.mailUrl
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const found = await getJson<MailpitSearch>(
      `${base}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
    )
    if (found.messages.length > 0) {
      const message = await getJson<MailpitMessage>(
        `${base}/api/v1/message/${found.messages[0].ID}`,
      )
      const link = /https?:\/\/[^\s"<>]+\/auth\/v1\/verify[^\s"<>]*/.exec(message.Text)
      if (!link) throw new Error(`No sign-in link in the email to ${address}`)
      return link[0].replace(/&amp;/g, '&')
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  throw new Error(`No email to ${address} arrived within ${POLL_TIMEOUT_MS} ms`)
}
