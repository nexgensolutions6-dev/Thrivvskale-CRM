'use client'

/**
 * The email form on the sign-in page. Asks Supabase to email a one-time
 * sign-in link (magic link) that comes back to `/auth/callback` in this same
 * browser. Rendered by `page.tsx`, which passes the already-validated `next`.
 */
import { useState, type FormEvent } from 'react'
import { DEFAULT_HOME_PATH } from '@/lib/auth/path-rules'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ERROR_ID = 'login-error'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }

/** A message a person can act on, for the error codes Supabase is known to return. */
function messageForSendError(code: string | undefined): string {
  switch (code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many sign-in emails were requested. Wait a minute and try again.'
    case 'email_address_invalid':
      return 'Enter a valid email address.'
    case 'signup_disabled':
      return 'Sign-ups are closed. Ask the workspace owner for access.'
    default:
      return 'We could not send the sign-in link. Please try again.'
  }
}

export function LoginForm({
  next,
  initialError,
}: {
  /** Page to open after signing in; already validated by the login page. */
  next: string
  /** Why the auth callback sent the visitor back here, if it did. */
  initialError?: string
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    if (!EMAIL_PATTERN.test(email)) {
      setStatus({ kind: 'error', message: 'Enter a valid email address.' })
      return
    }

    setStatus({ kind: 'sending' })
    const callback = new URL('/auth/callback', window.location.origin)
    if (next !== DEFAULT_HOME_PATH) callback.searchParams.set('next', next)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.toString() },
    })
    if (error) {
      console.error(`[login-form] signInWithOtp failed (${error.code ?? 'no code'}): ${error.message}`)
      setStatus({ kind: 'error', message: messageForSendError(error.code) })
      return
    }
    setStatus({ kind: 'sent', email })
  }

  const errorMessage =
    status.kind === 'error' ? status.message : status.kind === 'idle' ? initialError : undefined

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {status.kind === 'sent' ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
        >
          Check your inbox. We sent a sign-in link to {status.email}. It works once, in this
          browser.
        </p>
      ) : null}

      {errorMessage ? (
        <p
          id={ERROR_ID}
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? ERROR_ID : undefined}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
        />
      </div>

      <button
        type="submit"
        disabled={status.kind === 'sending'}
        className="rounded-md bg-zinc-900 px-4 py-2.5 text-base font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {status.kind === 'sending' ? 'Sending...' : 'Email me a sign-in link'}
      </button>
    </form>
  )
}
