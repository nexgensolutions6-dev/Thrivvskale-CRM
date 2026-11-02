/*
 * ThrivvSkale CRM service worker (hand-written, no build plugin). Registered by
 * src/components/pwa/ServiceWorkerRegister.tsx.
 *
 * WHAT IT CACHES (the whole list):
 *   - at install: /offline.html, /manifest.webmanifest and the app icons;
 *   - while running: static files only - /_next/static/ (built JS and CSS),
 *     /wallpapers/ and /icons/ - and only successful same-origin GET responses.
 *
 * WHAT IT NEVER CACHES: pages, server-action calls, RSC payloads, API routes or
 * anything else that can differ per user. Those requests are left alone or, for page
 * navigations, sent to the network; if the network is down the worker answers with
 * /offline.html. Because no authenticated response is ever stored, nothing one user
 * saw can be shown to the next person who signs in on the same device.
 *
 * STATIC FILES USE "network first": always fresh when online (also in `next dev`,
 * where file names are not content-hashed), the cached copy only when offline.
 *
 * To change what is cached, bump CACHE_NAME; activate then deletes older caches.
 */
const CACHE_NAME = 'thrivvskale-shell-v1'
const CACHE_PREFIX = 'thrivvskale-shell-'
const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']
const STATIC_PREFIXES = ['/_next/static/', '/wallpapers/', '/icons/']

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // never touch form posts or server actions

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // other sites' files are not ours to store

  if (request.mode === 'navigate') {
    event.respondWith(pageOrOffline(request))
  } else if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(staticNetworkFirst(event, request))
  }
  // Everything else (data, RSC, API): no respondWith, the browser handles it as usual.
})

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME)
  // credentials: 'omit' - these files are public, so no cookies need to travel with them.
  await Promise.all(PRECACHE_URLS.map((url) => cache.add(new Request(url, { credentials: 'omit' }))))
}

async function deleteOldCaches() {
  const names = await caches.keys()
  const stale = names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
  await Promise.all(stale.map((name) => caches.delete(name)))
}

/** Pages always come from the network (never stored). Offline: the offline page. */
async function pageOrOffline(request) {
  try {
    return await fetch(request)
  } catch (error) {
    const offline = await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME })
    if (offline) return offline
    console.warn('[sw] page request failed and /offline.html is not cached:', error)
    return Response.error()
  }
}

async function staticNetworkFirst(event, request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.status === 200 && response.type === 'basic') {
      event.waitUntil(cache.put(request, response.clone()))
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}
