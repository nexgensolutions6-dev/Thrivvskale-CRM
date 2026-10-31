import { defineConfig, devices } from '@playwright/test'
import { localStack } from './tests/support/local-stack'

const port = 3100
const baseURL = `http://127.0.0.1:${port}`

// The app under test talks to the local Supabase stack. Connection details come
// from the environment or `npx supabase status -o env`; nothing is hard-coded
// here or written to disk. Exporting them to process.env lets the test workers
// (which build admin clients and read the Mailpit inbox) reuse them instead of
// asking the CLI again.
const stack = localStack()
process.env.SUPABASE_URL = stack.apiUrl
process.env.SUPABASE_ANON_KEY = stack.anonKey
process.env.SUPABASE_SERVICE_ROLE_KEY = stack.serviceRoleKey
process.env.SUPABASE_DB_URL = stack.dbUrl
process.env.SUPABASE_MAIL_URL = stack.mailUrl

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
    },
  },
})
