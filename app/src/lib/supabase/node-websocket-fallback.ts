/**
 * Gives server-side Supabase clients a WebSocket when Node has none (Node 20).
 * Spread into the options of `server-client.ts`, `refresh-session.ts` and
 * `admin-client.ts`. Server code only: browsers have their own WebSocket.
 */
import type { SupabaseClientOptions } from '@supabase/supabase-js'
import { WebSocket as WsWebSocket } from 'ws'

type Transport = NonNullable<SupabaseClientOptions<'public'>['realtime']>['transport']

/**
 * supabase-js builds its realtime client eagerly and throws when there is no
 * WebSocket. Node 22+ has one built in; Node 20, which this project supports,
 * does not, so the `ws` package fills the gap. Nothing here opens a
 * connection: the app uses no realtime features.
 */
export const nodeWebSocketOptions: Pick<SupabaseClientOptions<'public'>, 'realtime'> =
  typeof globalThis.WebSocket === 'undefined'
    ? { realtime: { transport: WsWebSocket as unknown as Transport } }
    : {}
