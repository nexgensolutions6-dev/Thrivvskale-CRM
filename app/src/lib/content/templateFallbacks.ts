/**
 * Gives {name}, {honorific} and {company} safe wording when the lead has none
 * ("there", nothing, "your business") and tidies the spaces an empty value
 * leaves behind. Pure. Used by buildTemplateMessage.
 */
import type { TemplateContext } from '@/lib/language/variants'

const NAME_FALLBACK = 'there'
const COMPANY_FALLBACK = 'your business'

function clean(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function withFallbacks(who: TemplateContext): Required<TemplateContext> {
  const name = clean(who.name)
  // A title without a name ("there garu") reads wrong, so it goes too.
  const honorific = name === '' ? '' : clean(who.honorific)
  return {
    name: name === '' ? NAME_FALLBACK : name,
    honorific,
    company: clean(who.company) === '' ? COMPANY_FALLBACK : clean(who.company),
  }
}

export function tidySpaces(text: string): string {
  return text.replace(/ +([,.!?;:])/g, '$1').replace(/ {2,}/g, ' ')
}
