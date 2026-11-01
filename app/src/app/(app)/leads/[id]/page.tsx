/**
 * /leads/[id] - the lead workspace: header (Maps, website chip), why call,
 * what to sell, opener picker, people and numbers, privacy (DND, erase,
 * export), and the Timeline / Tasks tabs. Loads the lead for the signed-in user's own workspace (getLead calls
 * getSessionWorkspace itself); an unknown or foreign id is a 404. The (app)
 * layout supplies <main>.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Surface } from '@/components/glass/Surface'
import { LeadHeader } from '@/components/lead/LeadHeader'
import { LeadTabs } from '@/components/lead/LeadTabs'
import { OpenerPicker } from '@/components/lead/OpenerPicker'
import { PeoplePanel } from '@/components/lead/PeoplePanel'
import { PrivacyMenu } from '@/components/lead/PrivacyMenu'
import { WhatToSell } from '@/components/lead/WhatToSell'
import { WhyCall } from '@/components/lead/WhyCall'
import { getLead } from '@/lib/leads/getLead'
import { LeadNotFoundError } from '@/lib/leads/loadLead'
import { buildOpenerChoices } from '@/lib/leads/openerChoices'

export const metadata: Metadata = { title: 'Lead | ThrivvSkale CRM' }

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await getLead(id).catch((error: unknown) => {
    if (error instanceof LeadNotFoundError) notFound()
    throw error
  })
  const choices = buildOpenerChoices(view)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Surface level="L3" className="p-4 sm:p-6">
        <LeadHeader company={view.company} />
      </Surface>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Surface level="L2" className="min-w-0 p-4 sm:p-6">
          <WhyCall company={view.company} callOutcomes={view.callOutcomes} />
        </Surface>
        <Surface level="L2" className="min-w-0 p-4 sm:p-6">
          <WhatToSell
            entryOffer={view.entryOffer}
            entryOfferIsDefault={view.entryOfferIsDefault}
            longTermOpportunity={view.longTermOpportunity}
          />
        </Surface>
      </div>
      <Surface level="L3" className="min-w-0 p-4 sm:p-6">
        <OpenerPicker openers={choices.openers} points={choices.points} mixLabel={choices.mixLabel} />
      </Surface>
      <Surface level="L2" className="min-w-0 p-4 sm:p-6">
        <PeoplePanel companyId={view.company.id} contacts={view.contacts} points={view.points} />
      </Surface>
      <Surface level="L2" className="min-w-0 p-4 sm:p-6">
        <PrivacyMenu companyId={view.company.id} dnd={view.company.dnd} contacts={view.contacts} points={view.points} />
      </Surface>
      <Surface level="L2" className="min-w-0 p-4 sm:p-6">
        <LeadTabs companyId={view.company.id} activities={view.activities} tasks={view.tasks} />
      </Surface>
    </div>
  )
}
