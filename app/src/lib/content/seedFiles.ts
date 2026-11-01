/**
 * The starter content files (supabase/seed/*.json) with their types. Read by the
 * three seed modules; nothing else imports the JSON directly.
 */
import objectionsJson from '../../../supabase/seed/objections.json'
import playbooksJson from '../../../supabase/seed/playbooks.json'
import templatesJson from '../../../supabase/seed/templates.json'

export interface SeedPlaybook {
  serviceKey: string
  title: string
  pitch: string
  discoveryQuestions: string[]
  deliverables: string[]
  pricingGuidance: string
}

export interface SeedObjection {
  key: string
  text: string
  response: string
}

export interface SeedTemplate {
  key: string
  title: string
  body: string
}

export const SEED_PLAYBOOKS: SeedPlaybook[] = playbooksJson
export const SEED_OBJECTIONS: SeedObjection[] = objectionsJson
export const SEED_TEMPLATES: SeedTemplate[] = templatesJson
