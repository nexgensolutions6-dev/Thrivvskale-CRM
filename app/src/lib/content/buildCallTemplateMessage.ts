/**
 * Builds the WhatsApp follow-up for the call that was just made: the mix spoken
 * on the call (the outcome sheet's chips) picks both the template variant and
 * the honorific, not the number's saved mix. Pure. Called by TemplatePicker.
 */
import type { CallPoint, CallTemplate } from '@/lib/call/callScreen'
import type { Mix } from '@/lib/domain'
import { honorificFor } from '@/lib/language/honorific'
import { buildTemplateMessage, type TemplateMessage } from './buildTemplateMessage'

export function buildCallTemplateMessage(
  template: CallTemplate,
  point: CallPoint,
  companyName: string,
  mix: Mix,
): TemplateMessage | null {
  const who = { name: point.greetingName, company: companyName, honorific: honorificFor(mix[0] ?? 'en', 'formal') }
  return buildTemplateMessage(template, point, mix, who)
}
