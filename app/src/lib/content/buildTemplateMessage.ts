/**
 * Turns one template into the message for one phone point: picks the variant
 * in the contact's mix, fills {name}, {honorific} and {company}, and builds the
 * wa.me link (null for a number that cannot get WhatsApp). An empty mix counts
 * as English. Returns null when no variant of the template fits. Pure. Called
 * by the TemplatePicker.
 */
import type { CallTemplate } from '@/lib/call/callScreen'
import type { Mix, WaStatus } from '@/lib/domain'
import { fillTemplate, pickVariant, type TemplateContext } from '@/lib/language/variants'
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
  const text = fillTemplate(picked.variant.body, who)
  return { text, link: buildWaLink(point, text) }
}
