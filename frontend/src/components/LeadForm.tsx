import { useState, type FormEvent, type ReactNode } from 'react';
import { STAGES, TEMPERATURES, fromLocalInput, isClosed, toLocalInput } from '../lib/format';
import { useLeadMeta, useUsers } from '../lib/queries';
import type { Lead, LeadInput, Stage, Temperature } from '../types';

interface Values {
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  qualified: string;
  temperature: Temperature;
  stage: Stage;
  assigned: string;
  followUp: string;
}

const QUALIFIED_VALUES: Record<string, boolean | null> = { '': null, true: true, false: false };

function initialValues(lead: Lead | undefined, defaultAssignee: number): Values {
  return {
    name: lead?.name ?? '',
    company: lead?.company ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    source: lead?.source ?? '',
    qualified: lead?.qualified == null ? '' : String(lead.qualified),
    temperature: lead?.temperature ?? 'warm',
    stage: lead?.stage ?? 'new',
    assigned: lead ? String(lead.assigned_to_id ?? '') : String(defaultAssignee),
    followUp: toLocalInput(lead?.next_follow_up ?? null),
  };
}

function toInput(values: Values): LeadInput {
  return {
    name: values.name.trim(),
    company: values.company.trim() || null,
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
    source: values.source.trim() || null,
    qualified: QUALIFIED_VALUES[values.qualified],
    temperature: values.temperature,
    stage: values.stage,
    assigned_to_id: values.assigned ? Number(values.assigned) : null,
    next_follow_up: isClosed(values.stage) ? null : fromLocalInput(values.followUp),
  };
}

interface Props {
  lead?: Lead;
  defaultAssignee: number;
  submitLabel: string;
  onSubmit: (input: LeadInput) => Promise<unknown>;
  footer?: ReactNode;
}

export function LeadForm({ lead, defaultAssignee, submitLabel, onSubmit, footer }: Props) {
  const users = useUsers();
  const meta = useLeadMeta();
  const [values, setValues] = useState(() => initialValues(lead, defaultAssignee));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.phone.trim() && !values.email.trim()) {
      setError('Enter a phone number or an email');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(toInput(values));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="lead-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>Name *</span>
          <input required maxLength={200} value={values.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span>Company</span>
          <input maxLength={200} value={values.company} onChange={(e) => set('company', e.target.value)} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input type="tel" maxLength={40} value={values.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" maxLength={255} value={values.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="field">
          <span>Source</span>
          <input list="lead-sources" maxLength={80} value={values.source}
            onChange={(e) => set('source', e.target.value)} />
          <datalist id="lead-sources">
            {meta.data?.sources.map((source) => <option key={source} value={source} />)}
          </datalist>
        </label>
        <label className="field">
          <span>Qualified</span>
          <select value={values.qualified} onChange={(e) => set('qualified', e.target.value)}>
            <option value="">Not reviewed</option>
            <option value="true">True lead</option>
            <option value="false">False lead</option>
          </select>
        </label>
        <label className="field">
          <span>Temperature</span>
          <select value={values.temperature} onChange={(e) => set('temperature', e.target.value as Temperature)}>
            {TEMPERATURES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Stage</span>
          <select value={values.stage} onChange={(e) => set('stage', e.target.value as Stage)}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Assigned to</span>
          <select value={values.assigned} onChange={(e) => set('assigned', e.target.value)}>
            <option value="">Unassigned</option>
            {users.data?.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Next follow-up</span>
          <input type="datetime-local" value={isClosed(values.stage) ? '' : values.followUp}
            disabled={isClosed(values.stage)} onChange={(e) => set('followUp', e.target.value)} />
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {footer}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
