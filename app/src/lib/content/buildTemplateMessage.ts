/**
 * Turns one template into the message for one phone point: picks the variant
 * in the contact's mix, fills {name}, {honorific} and {company}, and builds the
 * wa.me link (null for a number that cannot get WhatsApp). An empty mix counts
 * as English. Missing name/company get fallback wording. Returns null when no
 * variant fits or a placeholder cannot be filled. Pure. Called by the
 * TemplatePicker.
 */
import type { CallTemplate } from '@/lib/call/callScreen'
import type { Mix, WaStatus } from '@/lib/domain'
import { pickVariant, type TemplateContext } from '@/lib/language/variants'
import { fillSafeText } from '@/lib/content/fillSafeText'
import { buildWaLink, type WaLink } from '@/lib/whatsapp/link'

export interface TemplateMessage {
  text: string
  link: WaLink | null
}

export function buildTemplateMessage(
  template: CallTemplate,
  point: { e164: string; waStatus: WaStatus },
  mix: Mix,
  who: TemplateContext,
): TemplateMessage | null {
  const wanted: Mix = mix.length > 0 ? mix : ['en']
  const picked = pickVariant(template.variants, { mix: wanted, script: 'latin', register: 'formal' })
  if (picked === null) return null
  // A leftover {placeholder} must never reach a customer: show no message instead.
  const text = fillSafeText(picked.variant.body, who, `template ${template.id}`)
  if (text === null) return null
  return { text, link: buildWaLink(point, text) }
}
