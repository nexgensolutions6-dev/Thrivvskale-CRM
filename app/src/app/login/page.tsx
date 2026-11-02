/**
 * The sign-in page (`/login`): explains the magic-link login and shows the
 * form. Reads two query parameters: `next` (where to go after signing in) and
 * `error` (why the auth callback sent the visitor back). Rendered by Next.
 */
import type { Metadata } from 'next'
import { safeNextPath } from '@/lib/auth/next-param'
import { DEFAULT_HOME_PATH } from '@/lib/auth/path-rules'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in | ThrivvSkale CRM' }

/** What the auth callback route can tell us went wrong. */
const CALLBACK_ERRORS: Record<string, string> = {
  link_invalid:
    'That sign-in link is invalid, expired, or was opened in a different browser. Request a new one below.',
  link_missing: 'That sign-in link is incomplete. Request a new one below.',
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams

  const next = typeof params.next === 'string' ? safeNextPath(params.next) : DEFAULT_HOME_PATH
  const callbackError = typeof params.error === 'string' ? CALLBACK_ERRORS[params.error] : undefined

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to ThrivvSkale CRM</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Enter your email and we will send you a one-time sign-in link. No password needed.
        </p>
      </header>
      <LoginForm next={next} initialError={callbackError} />
    </main>
  )
}
