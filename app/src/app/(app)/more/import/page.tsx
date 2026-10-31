/**
 * The Import screen at /more/import: choose a lead CSV, see what an import
 * would do, confirm it. The work happens in import-form.tsx and actions.ts.
 */
import { ImportForm } from './import-form'

export default function ImportPage() {
  return (
    <main>
      <h1>Import leads</h1>
      <p>Choose the leads CSV, check the preview, then confirm. Importing the same file again changes nothing twice.</p>
      <ImportForm />
    </main>
  )
}
