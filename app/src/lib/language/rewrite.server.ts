/**
 * `rewriteVariant`: asks Claude to rewrite English text into a language mix.
 * Server only (reads the API key from the environment). Called by
 * createDraft.ts; tests inject a mock client instead of the real one.
 */
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { stepError } from '@/lib/step-error'
import { buildRewritePrompt, REWRITE_SYSTEM_PROMPT, type RewriteInput } from './buildRewritePrompt'

const MODULE = 'rewrite.server'
const DEFAULT_MODEL = 'claude-sonnet-5-5'
const MAX_OUTPUT_TOKENS = 2000

export async function rewriteVariant(
  input: RewriteInput,
  client?: Pick<Anthropic, 'messages'>,
): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL
  let response
  try {
    // Built here, not as a default parameter, so a missing API key is named by stepError.
    const c = client ?? new Anthropic()
    response = await c.messages.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: REWRITE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildRewritePrompt(input) }],
    })
  } catch (error) {
    throw stepError(MODULE, `call model ${model}`, error)
  }
  if (response.stop_reason === 'max_tokens') throw stepError(MODULE, 'read reply', 'reply cut off (max_tokens)')
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim()
  if (!text) {
    throw stepError(MODULE, `read reply from ${model}`, `empty reply (stop_reason ${response.stop_reason})`)
  }
  return text
}
