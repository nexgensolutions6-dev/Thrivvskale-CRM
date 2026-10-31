import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { LEADS_KEY, useInvalidateLeads } from '../lib/queries';
import type { LeadInput } from '../types';
import { LeadForm } from './LeadForm';
import { ConfirmDialog, Modal } from './Modal';
import { useToast } from './Toast';

const SAVED_NOTICE_MS = 2500;

export function LeadDrawer({ leadId, onClose }: { leadId: number; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const invalidate = useInvalidateLeads();
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);

  const detail = useQuery({ queryKey: [LEADS_KEY, 'detail', leadId], queryFn: () => api.lead(leadId) });
  const lead = detail.data;

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const addNote = useMutation({
    mutationFn: () => api.addNote(leadId, note.trim()),
    onSuccess: () => {
      setNote('');
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteLead(leadId),
    onSuccess: () => {
      toast('Lead deleted');
      invalidate();
      onClose();
    },
    onError: (error) => {
      setConfirming(false);
      toast(error.message, 'error');
    },
  });

  const save = async (input: LeadInput) => {
    await api.updateLead(leadId, input);
    await invalidate();
    setSaved(true);
  };

  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    if (note.trim()) addNote.mutate();
  };

  return (
    <Modal title={lead?.name ?? 'Lead'} variant="drawer" onClose={onClose}>
      {detail.isPending && <p className="muted" role="status">Loading…</p>}
      {detail.isError && <p className="form-error" role="alert">{detail.error.message}</p>}
      {lead && user && (
        <>
          <LeadForm
            key={`${lead.id}-${lead.updated_at}`}
            lead={lead}
            defaultAssignee={user.id}
            submitLabel="Save changes"
            onSubmit={save}
            footer={
              <>
                {user.role === 'owner' && (
                  <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirming(true)}>
                    <Trash2 size={15} aria-hidden="true" />
                    Delete
                  </button>
                )}
                <span className="saved-notice" role="status">{saved ? 'Saved' : ''}</span>
              </>
            }
          />

          <section className="timeline" aria-label="Notes and activity">
            <h3>Notes and activity</h3>
            <form className="note-form" onSubmit={submitNote}>
              <textarea
                rows={2}
                aria-label="Add a note"
                placeholder="Add a note about this lead…"
                maxLength={5000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn" disabled={!note.trim() || addNote.isPending}>Add note</button>
            </form>
            {addNote.isError && <p className="form-error" role="alert">{addNote.error.message}</p>}
            <ol>
              {lead.activities.map((activity) => (
                <li key={activity.id} className={`activity activity-${activity.kind}`}>
                  <p>{activity.body}</p>
                  <small>
                    {activity.user_name ? `${activity.user_name} · ` : ''}
                    {formatDateTime(activity.created_at)}
                  </small>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {confirming && lead && (
        <ConfirmDialog
          title="Delete this lead?"
          message={`${lead.name} and all its notes will be permanently removed.`}
          confirmLabel="Delete lead"
          busy={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </Modal>
  );
}
