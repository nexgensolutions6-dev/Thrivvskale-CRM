/**
 * /more/playbooks - one card per service: the pitch, discovery questions,
 * deliverables and pricing guidance (empty until the owner supplies prices).
 * Loads with the signed-in user's client. Rendered inside the (app) shell.
 */
import type { Metadata } from 'next'
import { Surface } from '@/components/glass/Surface'
import { MUTED } from '@/components/lead/styles'
import { loadPlaybooks } from '@/lib/content/loadPlaybooks'
import { createSupabaseServerClient } from '@/lib/supabase/server-client'
import { getSessionWorkspace } from '@/lib/workspace'

export const metadata: Metadata = { title: 'Playbooks | ThrivvSkale CRM' }

export default async function PlaybooksPage() {
  const { workspaceId } = await getSessionWorkspace()
  const db = await createSupabaseServerClient()
  const playbooks = await loadPlaybooks(db, workspaceId)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Playbooks</h1>
      {playbooks.length === 0 && <Surface level="L2" className="p-6">No playbooks yet.</Surface>}
      {playbooks.map((playbook) => (
        <Surface key={playbook.id} level="L2" className="flex flex-col gap-3 p-6">
          <h2 className="text-xl font-semibold">{playbook.title}</h2>
          <p className="break-words">{playbook.pitch}</p>
          <h3 className="font-medium">Discovery questions</h3>
          <ul className="list-disc pl-5">
            {playbook.discoveryQuestions.map((question) => <li key={question} className="break-words">{question}</li>)}
          </ul>
          <h3 className="font-medium">Deliverables</h3>
          <ul className="list-disc pl-5">
            {playbook.deliverables.map((item) => <li key={item} className="break-words">{item}</li>)}
          </ul>
          <h3 className="font-medium">Pricing guidance</h3>
          <p className={playbook.pricingGuidance ? 'break-words' : MUTED}>
            {playbook.pricingGuidance || 'Not set yet. Add your prices when you are ready.'}
          </p>
        </Surface>
      ))}
    </div>
  )
}
