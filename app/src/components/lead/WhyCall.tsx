/**
 * "Why call": the lead's buying-intent signal, its problem and evidence, and
 * the score broken down into lines that add up to the queue score. Server
 * component; used by the /leads/[id] page.
 */
import type { Outcome } from '@/lib/domain'
import type { CompanyRow } from '@/lib/leads/leadView'
import { scoreBreakdown } from '@/lib/leads/scoreBreakdown'
import { MUTED } from './styles'

export function WhyCall({ company, callOutcomes }: { company: CompanyRow; callOutcomes: Outcome[] }) {
  const intent = Boolean(company.intent_signal)
  const breakdown = scoreBreakdown(company.base_score, { intent, outcomes: callOutcomes })
  return (
    <section aria-labelledby="why-call-heading" className="flex flex-col gap-3">
      <h2 id="why-call-heading" className="text-lg font-semibold">Why call</h2>
      {company.intent_signal && (
        <p>
          <span className="font-medium">Intent signal: </span>
          <span className="break-words">{company.intent_signal}</span>
        </p>
      )}
      <div>
        <h3 className="font-medium">Problem / Evidence</h3>
        <p className={`break-words ${MUTED}`}>{company.problem_evidence ?? 'None recorded.'}</p>
      </div>
      <div>
        <h3 className="font-medium">Score breakdown</h3>
        <ul className="mt-1 flex flex-col gap-1">
          {breakdown.lines.map((line, index) => (
            <li key={line.label} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">{line.label}</span>
              <span>{index > 0 && line.points > 0 ? `+${line.points}` : line.points}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-current pt-1 text-sm font-semibold">
            <span>Total</span>
            <span>{breakdown.total}</span>
          </li>
        </ul>
      </div>
    </section>
  )
}
