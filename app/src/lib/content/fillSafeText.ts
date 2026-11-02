/**
 * Fills {name}, {honorific} and {company} in a script body using the safe
 * fallbacks, tidies spaces, and returns null if any {placeholder} is still
 * left, so a customer never sees one. Pure. Used by buildTemplateMessage
 * and buildOpenerChoices.
 */
import { fillTemplate, type TemplateContext } from '@/lib/language/variants'
import { tidySpaces, withFallbacks } from '@/lib/content/templateFallbacks'

export function fillSafeText(body: string, who: TemplateContext, label: string): string | null {
  const text = tidySpaces(fillTemplate(body, withFallbacks(who)))
  if (/\{[^}]*\}/.test(text)) {
    console.error(`[fillSafeText] fill ${label}: unfilled placeholder left in text`)
    return null
  }
  return text
}
