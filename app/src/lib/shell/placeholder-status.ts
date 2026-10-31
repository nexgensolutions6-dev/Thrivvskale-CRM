/**
 * PLACEHOLDER numbers for the menu bar's "today's targets" and "sync status"
 * chips. There is no data layer for either yet, so the values live here, in one
 * place. While STATUS_IS_PLACEHOLDER is true the menu bar shows a visible
 * "sample" tag and a muted (hollow) sync dot. When real data exists, replace the
 * exports below with real queries and set the flag to false. Used by MenuBar only.
 */

/** The single switch: true while targets and sync are made-up values. */
export const STATUS_IS_PLACEHOLDER = true

export const PLACEHOLDER_NOTE = 'sample'

export const PLACEHOLDER_TARGETS = { callsDone: 0, callsGoal: 40 }

export const PLACEHOLDER_SYNC = { label: 'Synced' }
