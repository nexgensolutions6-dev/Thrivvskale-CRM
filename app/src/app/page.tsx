/**
 * "/" has no screen of its own: signed-in visitors go to Today. (Visitors
 * without a session are sent to /login by src/proxy.ts before they get here.)
 */
import { redirect } from 'next/navigation'
import { DEFAULT_HOME_PATH } from '@/lib/auth/path-rules'

export default function Home() {
  redirect(DEFAULT_HOME_PATH)
}
