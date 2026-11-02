/**
 * Groups template rows (kind 'template') into one entry per English template,
 * with its rewrites attached, sorted by title. Rewrites point at their English
 * original through parentVariantId. Pure. Called by loadTemplates.
 */
import type { CallTemplate } from '@/lib/call/callScreen'
import type { ContentVariant } from '@/lib/language/types'

export type TemplateRow = ContentVariant & { title: string | null }

export function groupTemplates(rows: TemplateRow[]): CallTemplate[] {
  const originals = rows.filter((row) => row.parentVariantId === null)
  const groups = originals.map((original) => ({
    id: original.id,
    title: original.title ?? original.body.slice(0, 40),
    variants: [original, ...rows.filter((row) => row.parentVariantId === original.id)].map(withoutTitle),
  }))
  return groups.sort((a, b) => a.title.localeCompare(b.title))
}

function withoutTitle(row: TemplateRow): ContentVariant {
  return {
    id: row.id,
    kind: row.kind,
    mix: row.mix,
    script: row.script,
    register: row.register,
    body: row.body,
    parentVariantId: row.parentVariantId,
  }
}
