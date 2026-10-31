/**
 * The route guard: Next 16 calls this file `proxy` (it used to be `middleware`).
 * Next runs it before every page request to decide: show the page, or redirect.
 * The rules about which paths need a session live in `lib/auth/path-rules.ts`.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_HOME_PATH, LOGIN_PATH, isLoginPath, isPublicPath } from '@/lib/auth/path-rules'
import { refreshSession } from '@/lib/supabase/refresh-session'

/**
 *  - `/auth/*` and static assets: allowed, no session check.
 *  - `/login`: allowed, but a signed-in visitor is sent on to `/today`.
 *  - every other path: needs a session, otherwise redirect to `/login` and
 *    remember where the visitor was headed in `?next=`.
 *
 * Protected paths get a quick, optimistic check (the token verifies). Server
 * code that touches data re-checks with the auth server through
 * `getSessionWorkspace()`.
 *
 * Redirect loop: a token outlives its user (deleted, banned, signed out
 * elsewhere) until it expires. The optimistic check still says "signed in", so
 * `/today` loads, `getSessionWorkspace()` finds the user gone and redirects to
 * `/login`. If `/login` used the same optimistic check it would send the visitor
 * straight back to `/today`, and the browser would loop. So `/login` alone asks
 * the auth server, and a visitor it does not know gets the login form.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const onLoginPage = isLoginPath(pathname)

  if (isPublicPath(pathname) && !onLoginPage) return NextResponse.next()

  // Only the login page pays for the auth-server round trip (see "Redirect loop" above).
  const check = onLoginPage ? 'auth-server' : 'claims'
  const { response, signedIn } = await refreshSession(request, check)

  if (onLoginPage) {
    return signedIn ? redirectKeepingCookies(response, urlForPath(request, DEFAULT_HOME_PATH)) : response
  }
  if (signedIn) return response

  const loginUrl = urlForPath(request, LOGIN_PATH)
  if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`)
  return redirectKeepingCookies(response, loginUrl)
}

/** The same site (host and port) as the request, at another path and with no query. */
function urlForPath(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return url
}

/**
 * A redirect that keeps the refreshed session cookies (and their cache
 * headers) from `session`. Returning a bare `NextResponse.redirect` would drop
 * them, and the browser would keep using an expired token.
 */
function redirectKeepingCookies(session: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url)
  for (const cookie of session.cookies.getAll()) redirect.cookies.set(cookie)
  for (const name of ['cache-control', 'expires', 'pragma']) {
    const value = session.headers.get(name)
    if (value) redirect.headers.set(name, value)
  }
  return redirect
}

export const config = {
  // Everything except Next's own static output; `isPublicPath` handles the rest.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
