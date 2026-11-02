/**
 * "What to sell": the entry offer (the company's own, else its vertical's
 * default, and says which) and the long-term opportunity. Server component;
 * used by the /leads/[id] page.
 */
import { CHIP, MUTED } from './styles'

export interface WhatToSellProps {
  entryOffer: string | null
  entryOfferIsDefault: boolean
  longTermOpportunity: string | null
}

export function WhatToSell({ entryOffer, entryOfferIsDefault, longTermOpportunity }: WhatToSellProps) {
  return (
    <section aria-labelledby="what-to-sell-heading" className="flex flex-col gap-3">
      <h2 id="what-to-sell-heading" className="text-lg font-semibold">What to sell</h2>
      <div>
        <h3 className="flex flex-wrap items-center gap-2 font-medium">
          Entry offer
          {entryOffer && entryOfferIsDefault && <span className={CHIP}>Vertical default</span>}
        </h3>
        <p className={`break-words ${MUTED}`}>{entryOffer ?? 'No entry offer set for this lead or its vertical.'}</p>
      </div>
      {longTermOpportunity && (
        <div>
          <h3 className="font-medium">Long-term opportunity</h3>
          <p className={`break-words ${MUTED}`}>{longTermOpportunity}</p>
        </div>
      )}
    </section>
  )
}
