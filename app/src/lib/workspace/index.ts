/**
 * Public entry point for workspace code: `import { getSessionWorkspace } from
 * '@/lib/workspace'`. Each function lives in its own file; this only
 * re-exports them. Server-only.
 */
export { ensureWorkspace } from './ensure-workspace'
export { getSessionWorkspace } from './get-session-workspace'
