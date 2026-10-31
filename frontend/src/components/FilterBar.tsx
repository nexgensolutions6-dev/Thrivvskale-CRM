import { TEMPERATURES } from '../lib/format';
import { useLeadMeta, useUsers } from '../lib/queries';
import type { LeadFilters, QualifiedFilter, Temperature } from '../types';

interface Props {
  filters: LeadFilters;
  onChange: (changes: Partial<LeadFilters>) => void;
  summary: string;
}

const PILLS: { key: Temperature | undefined; label: string }[] = [
  { key: undefined, label: 'All' },
  ...TEMPERATURES,
];

export function FilterBar({ filters, onChange, summary }: Props) {
  const users = useUsers();
  const meta = useLeadMeta();

  return (
    <section className="filters card" aria-label="Filter leads">
      <div className="pills" role="group" aria-label="Temperature">
        {PILLS.map((pill) => (
          <button
            key={pill.label}
            className={`pill ${filters.temperature === pill.key ? 'active' : ''}`}
            aria-pressed={filters.temperature === pill.key}
            onClick={() => onChange({ temperature: pill.key })}
          >
            {pill.label}
          </button>
        ))}
      </div>
      <span className="filters-divider" aria-hidden="true" />
      <label className="filter">
        <span>Source</span>
        <select
          value={filters.source ?? ''}
          onChange={(e) => onChange({ source: e.target.value || undefined })}
        >
          <option value="">All sources</option>
          {meta.data?.sources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
      </label>
      <label className="filter">
        <span>Qualified</span>
        <select
          value={filters.qualified ?? ''}
          onChange={(e) => onChange({ qualified: (e.target.value || undefined) as QualifiedFilter | undefined })}
        >
          <option value="">Any</option>
          <option value="true">True lead</option>
          <option value="false">False lead</option>
          <option value="unreviewed">Not reviewed</option>
        </select>
      </label>
      <label className="filter">
        <span>Rep</span>
        <select
          value={filters.assigned_to ?? ''}
          onChange={(e) => onChange({ assigned_to: e.target.value || undefined })}
        >
          <option value="">Everyone</option>
          {users.data?.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          <option value="unassigned">Unassigned</option>
        </select>
      </label>
      <p className="filters-summary" role="status">{summary}</p>
    </section>
  );
}
