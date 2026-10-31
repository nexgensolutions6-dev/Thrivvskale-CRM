/**
 * PLACEHOLDER numbers for the menu bar's "today's targets" and "sync status"
 * chips. There is no data layer for either yet, so the values live here, in one
 * place, and the menu bar labels them as samples. Replace this file's exports
 * with real queries when targets and sync exist. Used by MenuBar only.
 */

export const PLACEHOLDER_NOTE = 'sample'

export const PLACEHOLDER_TARGETS = { callsDone: 0, callsGoal: 40 }

/** 'synced' | 'syncing' | 'offline' once real sync exists. */
export const PLACEHOLDER_SYNC = { state: 'synced', label: 'Synced' }
