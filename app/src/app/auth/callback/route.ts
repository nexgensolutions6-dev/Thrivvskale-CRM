/**
 * Where the magic-link email brings the visitor back to (`/auth/callback`).
 * Swaps the one-time `code` in the link for a session cookie, makes sure the
 * user has a workspace, then redirects to the `next` page (default `/today`).
 * Next calls `GET` here; nothing else imports this file.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/lib/auth/next-param'
import { DEFAULT_HOME_PATH, LOGIN_PATH } from '@/lib/auth/path-rules'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { ensureWorkspace } from '@/lib/workspace'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = safeNextPath(searchParams.get('next'))

  const code = searchParams.get('code')
  if (!code) return backToLogin('link_missing', next)

  // The code is only valid in the browser that asked for the link: that browser
  // holds the matching "code verifier" cookie (PKCE).
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    console.warn(`[auth/callback] exchange code for session failed: ${error?.message ?? 'no user returned'}`)
    return backToLogin('link_invalid', next)
  }

  try {
    await ensureWorkspace(data.user.id)
  } catch (cause) {
    // The visitor is signed in. getSessionWorkspace() creates the workspace on
    // the next page, so do not strand them here.
    console.error(`[auth/callback] bootstrap workspace failed, continuing: ${errorText(cause)}`)
  }

  return redirectTo(next)
}

/** Sends the visitor to the login page with a reason, keeping where they were headed. */
function backToLogin(reason: 'link_missing' | 'link_invalid', next: string): NextResponse {
  const query = new URLSearchParams({ error: reason })
  if (next !== DEFAULT_HOME_PATH) query.set('next', next)
  return redirectTo(`${LOGIN_PATH}?${query}`)
}

/**
 * A redirect to a path on this site. The `location` is relative on purpose, so
 * the browser resolves it against the address it actually used. Building an
 * absolute URL from `request.nextUrl.origin` is not safe here: in development
 * it can say `localhost` for a visit to `127.0.0.1`, which would drop the
 * session cookie that was just set. Callers only pass paths that start with a
 * single `/` (see `safeNextPath`).
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { location: path } })
}

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
