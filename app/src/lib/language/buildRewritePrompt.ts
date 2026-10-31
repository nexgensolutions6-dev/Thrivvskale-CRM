/**
 * Builds the text sent to Claude for a rewrite. Pure: takes only the English
 * text, the target language settings and examples, so no company, contact or
 * phone data can leak into the prompt. Called by rewrite.server.ts.
 */
import type { Mix, Register, Script } from '@/lib/domain'
import { toMixText } from './mixText'

export type RewriteExample = { from: string; to: string }

export type RewriteInput = {
  text: string
  mix: Mix
  script: Script
  register: Register
  examples: RewriteExample[]
}

export const REWRITE_SYSTEM_PROMPT =
  'You rewrite English sales-call scripts for Indian small-business owners. ' +
  'Keep every {placeholder} exactly as written. Keep the meaning and the length similar. ' +
  'Reply with the rewritten text only, no quotes and no commentary.'

export function buildRewritePrompt(input: RewriteInput): string {
  const scriptName = input.script === 'native' ? 'native script' : 'Roman letters (Latin script)'
  const lines = [
    `Rewrite the English text below in this language mix: ${toMixText(input.mix)} (first language is primary).`,
    `Write it in ${scriptName}, in a ${input.register} register.`,
  ]
  if (input.examples.length > 0) {
    lines.push('', 'Approved examples of the style wanted:')
    input.examples.forEach((example, index) => {
      lines.push(`Example ${index + 1} English: ${example.from}`, `Example ${index + 1} rewrite: ${example.to}`)
    })
  }
  lines.push('', 'English text:', input.text)
  return lines.join('\n')
}
