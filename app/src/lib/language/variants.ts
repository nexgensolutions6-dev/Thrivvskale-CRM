/**
 * Public entry for content-variant helpers (types, pickVariant, fillTemplate).
 * Callers import from here; the logic lives in the small files beside it.
 */
export type { ContentVariant, WantedVariant, MatchLevel, PickedVariant } from './types'
export { pickVariant } from './pickVariant'
export { fillTemplate } from './fillTemplate'
export type { TemplateContext } from './fillTemplate'
