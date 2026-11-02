/**
 * The process categories a pain point can be filed under: one shared list for
 * every vertical (per-vertical taxonomies arrive in Phase 2). Used by the
 * PainPointForm and by validateLogCallInput.
 */
export const PROCESS_CATEGORIES = [
  'enquiry handling',
  'appointments/booking',
  'follow-ups',
  'billing & fee collection',
  'inventory/stock',
  'quotations',
  'attendance',
  'reporting',
  'other',
] as const

export type ProcessCategory = (typeof PROCESS_CATEGORIES)[number]
