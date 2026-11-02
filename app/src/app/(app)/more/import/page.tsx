/**
 * The Import screen at /more/import: choose a lead CSV, see what an import
 * would do, confirm it. The work happens in import-form.tsx and actions.ts.
 * The shell layout supplies <main>, so this page is a glass panel, not a landmark.
 */
import { Surface } from '@/components/glass/Surface'
import { ImportForm } from './import-form'

export default function ImportPage() {
  return (
    <Surface level="L3" className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Import leads</h1>
      <p>Choose the leads CSV, check the preview, then confirm. Importing the same file again changes nothing twice.</p>
      <ImportForm />
    </Surface>
  )
}
