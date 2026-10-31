import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_PATH,
  LOGIN_PATH,
  isAuthPath,
  isLoginPath,
  isPublicPath,
} from '@/lib/auth/path-rules'

describe('route constants', () => {
  it('sends people to /login to sign in and /today after they have', () => {
    expect(LOGIN_PATH).toBe('/login')
    expect(DEFAULT_HOME_PATH).toBe('/today')
  })
})

describe('isLoginPath', () => {
  it.each(['/login', '/login/'])('recognises %s', (path) => {
    expect(isLoginPath(path)).toBe(true)
  })

  it.each(['/', '/loginx', '/login-admin', '/leads/login', '/auth/login'])(
    'does not mistake %s for the login page',
    (path) => {
      expect(isLoginPath(path)).toBe(false)
    },
  )
})

describe('isPublicPath', () => {
  it.each([
    '/login',
    '/login/',
    '/auth/callback',
    '/auth/callback/',
    '/auth/anything/else',
    '/_next/static/chunks/app.js',
    '/_next/image',
    '/favicon.ico',
    '/manifest.webmanifest',
    '/manifest.json',
    '/sw.js',
    '/offline.html',
    '/apple-touch-icon.png',
    '/icons/icon-192.png',
    '/icons/icon-maskable-512.png',
    '/wallpapers/aurora-light-sm.avif',
    '/images/hero/photo.webp',
    '/next.svg',
    '/logo.png',
  ])('lets %s through without a session', (path) => {
    expect(isPublicPath(path)).toBe(true)
  })

  it.each([
    '/',
    '/today',
    '/leads',
    '/leads/123',
    '/leads/login',
    '/leads/export.png',
    '/api/export.png',
    '/login-admin',
    '/loginx',
    '/auth',
    '/authx',
    '/authx/callback',
    '/sw.json',
    '/offline.htm',
    '/offline.html/extra',
    '/wallpapers',
    '/wallpapers-private/x.png',
    '/icons',
    '/images',
  ])('guards %s', (path) => {
    expect(isPublicPath(path)).toBe(false)
  })
})

describe('isAuthPath', () => {
  it.each(['/auth/callback', '/auth/callback/', '/auth/anything/else'])('covers %s', (path) => {
    expect(isAuthPath(path)).toBe(true)
  })

  it.each(['/', '/auth', '/authx/callback', '/leads/auth/callback'])('does not cover %s', (path) => {
    expect(isAuthPath(path)).toBe(false)
  })
})
