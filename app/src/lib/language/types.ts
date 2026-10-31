/**
 * Shapes shared by the variant-matching files. Re-exported by variants.ts.
 */
import type { Mix, Register, Script } from '@/lib/domain'

export type ContentVariant = {
  id: string
  kind: 'opener' | 'template' | 'script' | 'objection'
  mix: Mix
  script: Script
  register: Register
  body: string
  parentVariantId: string | null
}

export type WantedVariant = { mix: Mix; script: Script; register: Register }

export type MatchLevel = 'exact' | 'primary' | 'english'

export type PickedVariant = { variant: ContentVariant; match: MatchLevel }
