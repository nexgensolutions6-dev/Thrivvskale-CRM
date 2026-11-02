/**
 * What the save-targets action answers: saved, or a plain-language reason it
 * was not. Types only. Used by actions.ts and targets-form.tsx.
 */
export type TargetsFormState = { status: 'idle' } | { status: 'saved' } | { status: 'error'; message: string }

export const IDLE_STATE: TargetsFormState = { status: 'idle' }
