'use client'
/**
 * Renders nothing. Registers /sw.js (public/sw.js) once the page is up, so the
 * app can be installed and shows an offline page without a connection.
 * Mounted by the root layout. What the worker caches is explained in sw.js.
 */
import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => console.warn('[pwa/ServiceWorkerRegister] registering /sw.js failed:', error))
  }, [])

  return null
}
