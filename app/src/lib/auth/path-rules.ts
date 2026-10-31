/**
 * Which URL paths need a signed-in user: everything except the login page, the
 * auth routes and static assets. Route groups such as `(app)` are not part of
 * URLs, so the rules work on paths. Called by `src/proxy.ts` and `next-param.ts`.
 */

export const LOGIN_PATH = '/login'
export const DEFAULT_HOME_PATH = '/today'

/** Files served from the site root (`public/`). */
const ROOT_FILES = new Set([
  '/favicon.ico',
  '/manifest.webmanifest',
  '/manifest.json',
  '/sw.js',
  '/offline.html',
])
const ROOT_IMAGE = /^\/[^/]+\.(?:svg|png|jpe?g|gif|webp|avif|ico)$/i

/** Folders of static assets: every file below them is public. */
const ASSET_FOLDERS = ['/_next/', '/icons/', '/images/', '/wallpapers/']

/** "/login/" and "/login" are the same page. The root path "/" stays as it is. */
export function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

export function isLoginPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === LOGIN_PATH
}

/** True for everything below `/auth/` (the magic-link callback lives there). */
export function isAuthPath(pathname: string): boolean {
  return stripTrailingSlash(pathname).startsWith('/auth/')
}

/**
 * True for paths a visitor without a session may load: the login page, the
 * auth routes below `/auth/` and static assets. Everything else needs a
 * session. The PWA files (manifest, service worker, offline page, icons) must
 * be here: the browser fetches them without asking who is signed in.
 */
export function isPublicPath(pathname: string): boolean {
  const path = stripTrailingSlash(pathname)
  if (isLoginPath(path)) return true
  if (isAuthPath(path)) return true
  if (ROOT_FILES.has(path)) return true
  if (ROOT_IMAGE.test(path)) return true
  return ASSET_FOLDERS.some((folder) => path.startsWith(folder))
}
