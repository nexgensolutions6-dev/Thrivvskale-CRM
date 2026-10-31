import { useMutation } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useInvalidateLeads } from '../lib/queries';
import { Modal } from './Modal';

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const invalidate = useInvalidateLeads();
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: (selected: File) => api.importLeads(selected),
    onSuccess: invalidate,
  });
  const result = upload.data;

  return (
    <Modal title="Import leads" onClose={onClose}>
      {!result && (
        <>
          <p className="muted import-hint">
            Upload an Excel (.xlsx) or CSV file. The first row must hold column names. A Name column is
            required, plus Phone or Email for each lead. Company, Source, Qualified, Temperature, Stage,
            Assigned To and Next Follow-up are picked up when present.
          </p>
          <label className="file-drop">
            <FileSpreadsheet size={24} aria-hidden="true" />
            <span>{file ? file.name : 'Choose a file'}</span>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                upload.reset();
              }}
            />
          </label>
          {upload.isError && <p className="form-error" role="alert">{upload.error.message}</p>}
          <div className="form-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!file || upload.isPending}
              onClick={() => file && upload.mutate(file)}
            >
              {upload.isPending ? 'Importing…' : 'Import'}
            </button>
          </div>
        </>
      )}

      {result && (
        <>
          <dl className="import-summary">
            <div><dt>Added</dt><dd>{result.created}</dd></div>
            <div><dt>Already in CRM</dt><dd>{result.duplicates}</dd></div>
            <div><dt>Could not import</dt><dd>{result.failed}</dd></div>
          </dl>
          {result.errors.length > 0 && (
            <ul className="import-errors">
              {result.errors.map((error) => (
                <li key={error.row}>Row {error.row}: {error.message}</li>
              ))}
            </ul>
          )}
          {result.failed > result.errors.length && (
            <p className="muted">Showing the first {result.errors.length} problems.</p>
          )}
          <div className="form-actions">
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </Modal>
  );
}
