/**
 * Language-mix helpers for a lead: read the text form ("te+en"), find a
 * contact's mix (mix_profile, else languages), and choose the mix for a lead
 * (primary contact's, else the workspace default, else English). Pure. Called
 * by loadLead, validateContactInput and the lead page.
 */
import { LANG_CODES, type LangCode, type Mix } from '@/lib/domain'
import { stepError } from '@/lib/step-error'

const MODULE = 'contactMix'
const MAX_LANGUAGES = LANG_CODES.length

/** "te+hi+en", "te, en" or "te en" becomes ['te','hi','en']. Empty text is []. Throws on an unknown code. */
export function parseMixText(text: string): Mix {
  const codes = text.split(/[+,\s]+/).filter((code) => code !== '')
  if (codes.length > MAX_LANGUAGES) {
    throw stepError(MODULE, 'read language mix', `too many languages (${codes.length}) in ${JSON.stringify(text)}`)
  }
  const mix: Mix = []
  for (const code of codes) {
    if (!isLangCode(code)) {
      const allowed = LANG_CODES.join(', ')
      throw stepError(MODULE, 'read language mix', `unknown language ${JSON.stringify(code)}, use ${allowed}`)
    }
    if (!mix.includes(code)) mix.push(code)
  }
  return mix
}

function isLangCode(code: string): code is LangCode {
  return (LANG_CODES as readonly string[]).includes(code)
}

export interface MixSource {
  mixProfile: string | null
  languages: LangCode[]
}

/** The contact's own mix, or null when they have none. A corrupt mix_profile is skipped with a warning. */
export function contactMix(contact: MixSource): Mix | null {
  if (contact.mixProfile) {
    try {
      const parsed = parseMixText(contact.mixProfile)
      if (parsed.length > 0) return parsed
    } catch (error) {
      console.warn(`[${MODULE}] ignoring unreadable mix_profile ${JSON.stringify(contact.mixProfile)}:`, error)
    }
  }
  return contact.languages.length > 0 ? [...contact.languages] : null
}

/** Primary contact's mix, else the workspace default mix, else English (pickVariant rejects an empty mix). */
export function leadMix(primary: MixSource | null, workspaceMix: Mix): Mix {
  const own = primary ? contactMix(primary) : null
  if (own) return own
  return workspaceMix.length > 0 ? [...workspaceMix] : ['en']
}
