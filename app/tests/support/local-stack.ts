/**
 * Connection details for the local Supabase stack, shared by the database
 * suite, the e2e suite and Playwright's config. Nothing is hard-coded: they
 * come from SUPABASE_* env vars or else from `npx supabase status -o env`.
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export interface LocalStack {
  apiUrl: string
  anonKey: string
  serviceRoleKey: string
  dbUrl: string
  /** Mailpit, which catches the stack's outgoing auth emails. */
  mailUrl: string
}

const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
const DEFAULT_MAIL_URL = 'http://127.0.0.1:54324'

function parseEnvOutput(output: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) vars[match[1]] = match[2].replace(/^"(.*)"$/, '$1')
  }
  return vars
}

function required(vars: Record<string, string | undefined>, key: string): string {
  const value = vars[key]
  if (!value) {
    throw new Error(
      `Missing ${key}. Is the local stack running? Try \`npx supabase start\`.`,
    )
  }
  return value
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/**
 * The helpers built on a stack create and delete auth users with the
 * service-role key and talk to the database directly, so they must never run
 * against a hosted project. Throws unless both the API and the database host
 * are 127.0.0.1 or localhost.
 */
export function assertLocalStack(stack: Pick<LocalStack, 'apiUrl' | 'dbUrl'>): void {
  for (const [what, url] of [
    ['Supabase API URL', stack.apiUrl],
    ['database URL', stack.dbUrl],
  ] as const) {
    const host = hostOf(url)
    if (host === undefined || !LOCAL_HOSTS.has(host)) {
      throw new Error(
        `Refusing to run: the ${what} host (${host ?? 'unparseable'}) is not a local ` +
          'Supabase stack. These helpers only run against 127.0.0.1 or localhost.',
      )
    }
  }
}

let cached: LocalStack | undefined

export function localStack(): LocalStack {
  if (cached) return cached
  const env = process.env
  if (
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    env.SUPABASE_DB_URL
  ) {
    cached = {
      apiUrl: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      dbUrl: env.SUPABASE_DB_URL,
      mailUrl: env.SUPABASE_MAIL_URL ?? DEFAULT_MAIL_URL,
    }
  } else {
    const output = execSync('npx supabase status -o env', {
      cwd: APP_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const vars = parseEnvOutput(output)
    cached = {
      apiUrl: required(vars, 'API_URL'),
      anonKey: required(vars, 'ANON_KEY'),
      serviceRoleKey: required(vars, 'SERVICE_ROLE_KEY'),
      dbUrl: required(vars, 'DB_URL'),
      mailUrl: vars.MAILPIT_URL ?? vars.INBUCKET_URL ?? DEFAULT_MAIL_URL,
    }
  }
  assertLocalStack(cached)
  return cached
}
