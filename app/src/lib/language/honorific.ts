/**
 * Chooses the honorific suffix for a call opener from the primary language
 * and register. Re-exported by mix.ts; used by the cockpit script panel.
 */
import type { LangCode, Register } from '@/lib/domain'

const FORMAL_HONORIFICS: Partial<Record<LangCode, string>> = {
  te: 'garu',
  hi: 'ji',
  kn: 'avare',
  en: 'sir/madam',
}

export function honorificFor(primary: LangCode, register: Register): string {
  if (register === 'casual') return 'sir'
  return FORMAL_HONORIFICS[primary] ?? 'sir'
}
