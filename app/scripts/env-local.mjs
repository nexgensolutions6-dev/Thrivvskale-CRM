// Fills the three Supabase settings in .env.local from the running LOCAL stack
// (`npx supabase status -o env`). .env.local is git-ignored, so the keys never
// reach a tracked file; other lines already in .env.local are left alone.
// Run it with: npm run env:local
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENV_FILE = new URL('../.env.local', import.meta.url)
const LOCAL_HOSTS = ['127.0.0.1', 'localhost']

/** Runs the Supabase CLI and returns its KEY=value output as an object. */
function readLocalStack() {
  const output = execSync('npx supabase status -o env', {
    cwd: APP_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const values = {}
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) values[match[1]] = match[2].replace(/^"(.*)"$/, '$1')
  }
  return values
}

/** Stops the script from ever writing hosted-project keys into .env.local. */
function assertLocalUrl(apiUrl) {
  const host = new URL(apiUrl ?? 'http://invalid').hostname
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(`[env-local] refusing to write .env.local: ${host} is not a local Supabase stack.`)
  }
}

/** Sets KEY=value in the list of lines, replacing an existing KEY= line or appending. */
function setLine(lines, key, value) {
  const index = lines.findIndex((line) => line.startsWith(`${key}=`))
  if (index === -1) lines.push(`${key}=${value}`)
  else lines[index] = `${key}=${value}`
}

const stack = readLocalStack()
assertLocalUrl(stack.API_URL)

const settings = {
  NEXT_PUBLIC_SUPABASE_URL: stack.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: stack.SERVICE_ROLE_KEY,
}
for (const [key, value] of Object.entries(settings)) {
  if (!value) {
    throw new Error(`[env-local] ${key} is missing from the stack status. Is it running? Try \`npx supabase start\`.`)
  }
}

const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').trimEnd() : ''
const lines = existing === '' ? [] : existing.split(/\r?\n/)
for (const [key, value] of Object.entries(settings)) setLine(lines, key, value)
writeFileSync(ENV_FILE, `${lines.join('\n')}\n`)

console.log(`[env-local] wrote ${Object.keys(settings).join(', ')} to .env.local`)
