import { useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { STAGES, TEMPERATURES } from '../lib/format';
import { useInvalidateLeads, useUsers } from '../lib/queries';
import type { BulkChanges, Stage, Temperature } from '../types';
import { ConfirmDialog } from './Modal';
import { useToast } from './Toast';

interface Props {
  ids: number[];
  onClear: () => void;
}

const UNASSIGNED = 'unassigned';

export function BulkBar({ ids, onClear }: Props) {
  const { user } = useAuth();
  const users = useUsers();
  const toast = useToast();
  const invalidate = useInvalidateLeads();
  const [confirming, setConfirming] = useState(false);
  const count = ids.length;
  const noun = count === 1 ? 'lead' : 'leads';

  const update = useMutation({
    mutationFn: (changes: BulkChanges) => api.bulkUpdate(ids, changes),
    onSuccess: ({ affected }) => {
      toast(`Updated ${affected} ${affected === 1 ? 'lead' : 'leads'}`);
      invalidate();
    },
    onError: (error) => toast(error.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: () => api.bulkDelete(ids),
    onSuccess: ({ affected }) => {
      toast(`Deleted ${affected} ${affected === 1 ? 'lead' : 'leads'}`);
      setConfirming(false);
      onClear();
      invalidate();
    },
    onError: (error) => {
      setConfirming(false);
      toast(error.message, 'error');
    },
  });

  return (
    <section className="bulk-bar" aria-label="Bulk actions">
      <strong>{count} selected</strong>
      <select
        aria-label="Assign selected leads"
        value=""
        disabled={update.isPending}
        onChange={(e) =>
          update.mutate({ assigned_to_id: e.target.value === UNASSIGNED ? null : Number(e.target.value) })
        }
      >
        <option value="" disabled>Assign to…</option>
        {users.data?.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
        <option value={UNASSIGNED}>Unassigned</option>
      </select>
      <select
        aria-label="Set stage of selected leads"
        value=""
        disabled={update.isPending}
        onChange={(e) => update.mutate({ stage: e.target.value as Stage })}
      >
        <option value="" disabled>Set stage…</option>
        {STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
      </select>
      <select
        aria-label="Set temperature of selected leads"
        value=""
        disabled={update.isPending}
        onChange={(e) => update.mutate({ temperature: e.target.value as Temperature })}
      >
        <option value="" disabled>Set temperature…</option>
        {TEMPERATURES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      {user?.role === 'owner' && (
        <button className="btn btn-danger-ghost" onClick={() => setConfirming(true)}>
          <Trash2 size={15} aria-hidden="true" />
          Delete
        </button>
      )}
      <button className="btn-link" onClick={onClear}>Clear selection</button>

      {confirming && (
        <ConfirmDialog
          title={`Delete ${count} ${noun}?`}
          message={`The selected ${noun} and all their notes will be permanently removed.`}
          confirmLabel={`Delete ${count} ${noun}`}
          busy={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
