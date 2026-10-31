/**
 * Replaces {name}, {company} and {honorific} in a script body. A missing
 * value or an unknown placeholder is left as written so gaps are visible.
 * Re-exported by variants.ts.
 */
export type TemplateContext = { name?: string; company?: string; honorific?: string }

const KNOWN_KEYS = ['name', 'company', 'honorific'] as const

export function fillTemplate(body: string, ctx: TemplateContext): string {
  let result = body
  for (const key of KNOWN_KEYS) {
    const value = ctx[key]
    if (value === undefined) continue
    result = result.split(`{${key}}`).join(value)
  }
  return result
}
