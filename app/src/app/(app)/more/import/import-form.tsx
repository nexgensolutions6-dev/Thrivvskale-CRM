'use client'

/**
 * The Import screen's form: file input, Preview, Confirm import, and the
 * counts. Used by page.tsx; talks to the actions in actions.ts. The file is
 * kept in state and sent again on confirm, so the preview and the import
 * read exactly the same file.
 */
import { useState, useTransition } from 'react'
import { oversizeMessage } from '@/lib/import/uploadLimit'
import { importUpload, previewUpload } from './actions'
import type { ImportActionResult } from './import-result'

type Stage = 'choose' | 'previewed' | 'imported'

const UPLOAD_FAILED = 'The upload failed. Try a smaller file, or try again.'

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>('choose')
  const [result, setResult] = useState<ImportActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: typeof previewUpload, nextStage: Stage) {
    if (!file) return
    const tooLarge = oversizeMessage(file)
    if (tooLarge) {
      setResult({ ok: false, message: tooLarge })
      return
    }

    const form = new FormData()
    form.set('file', file)
    startTransition(async () => {
      try {
        const outcome = await action(form)
        setResult(outcome)
        if (outcome.ok) setStage(nextStage)
      } catch {
        setResult({ ok: false, message: UPLOAD_FAILED })
      }
    })
  }

  function chooseFile(chosen: File | null) {
    setFile(chosen)
    setStage('choose')
    const tooLarge = chosen ? oversizeMessage(chosen) : null
    setResult(tooLarge ? { ok: false, message: tooLarge } : null)
  }

  return (
    <div>
      <label htmlFor="lead-file">Lead CSV file</label>
      <input
        id="lead-file"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
      />
      <button type="button" disabled={!file || pending} onClick={() => run(previewUpload, 'previewed')}>
        Preview
      </button>
      {stage === 'previewed' && (
        <button type="button" disabled={pending} onClick={() => run(importUpload, 'imported')}>
          Confirm import
        </button>
      )}
      {pending && <p role="status">Working...</p>}
      {result && !result.ok && <p role="alert">{result.message}</p>}
      {result?.ok && stage === 'previewed' && <Counts title="Preview" result={result} insertedLabel="Would insert" updatedLabel="Would update" />}
      {result?.ok && stage === 'imported' && <Counts title="Import report" result={result} insertedLabel="Inserted" updatedLabel="Updated" />}
    </div>
  )
}

function Counts(props: {
  title: string
  result: Extract<ImportActionResult, { ok: true }>
  insertedLabel: string
  updatedLabel: string
}) {
  const { report, rows } = props.result
  return (
    <section aria-label={props.title}>
      <h2>{props.title}</h2>
      <dl>
        <dt>Rows</dt>
        <dd>{rows}</dd>
        <dt>{props.insertedLabel}</dt>
        <dd>{report.inserted}</dd>
        <dt>{props.updatedLabel}</dt>
        <dd>{report.updated}</dd>
        <dt>Needs number</dt>
        <dd>{report.needsNumber}</dd>
        <dt>Invalid websites</dt>
        <dd>{report.websiteInvalid}</dd>
        <dt>WhatsApp not a number</dt>
        <dd>{report.unparsedWhatsapp}</dd>
      </dl>
    </section>
  )
}
