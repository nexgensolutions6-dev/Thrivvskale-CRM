import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { firstName, followUp, stageLabel } from '../lib/format';
import type { Lead, SortField, SortOrder } from '../types';
import { QualifiedBadge, SourceChip, TemperatureBadge } from './Badges';

export interface Sort {
  field: SortField;
  order: SortOrder;
}

interface Props {
  leads: Lead[];
  sort: Sort;
  onSort: (field: SortField) => void;
  selected: Set<number>;
  onSelect: (ids: number[], checked: boolean) => void;
  onOpen: (id: number) => void;
}

function SortHeader({ field, sort, onSort, children }: {
  field: SortField;
  sort: Sort;
  onSort: Props['onSort'];
  children: ReactNode;
}) {
  const active = sort.field === field;
  const Icon = sort.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className="th-sort" onClick={() => onSort(field)}>
        {children}
        {active && <Icon size={12} aria-hidden="true" />}
      </button>
    </th>
  );
}

export function LeadsTable({ leads, sort, onSort, selected, onSelect, onOpen }: Props) {
  const pageIds = leads.map((lead) => lead.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  const headerBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerBox.current) headerBox.current.indeterminate = selectedOnPage > 0 && !allSelected;
  }, [selectedOnPage, allSelected]);

  return (
    <div className="table-scroll">
      <table className="leads-table">
        <thead>
          <tr>
            <th className="col-check">
              <input
                ref={headerBox}
                type="checkbox"
                aria-label="Select all leads on this page"
                checked={allSelected}
                onChange={(e) => onSelect(pageIds, e.target.checked)}
              />
            </th>
            <SortHeader field="name" sort={sort} onSort={onSort}>Name / Company</SortHeader>
            <th>Phone</th>
            <th>Email</th>
            <SortHeader field="source" sort={sort} onSort={onSort}>Source</SortHeader>
            <th>Qualified</th>
            <th>Temp.</th>
            <th>Stage</th>
            <SortHeader field="assigned" sort={sort} onSort={onSort}>Assigned</SortHeader>
            <SortHeader field="next_follow_up" sort={sort} onSort={onSort}>Next follow-up</SortHeader>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const due = followUp(lead);
            return (
              <tr key={lead.id} className={selected.has(lead.id) ? 'selected' : ''} onClick={() => onOpen(lead.id)}>
                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${lead.name}`}
                    checked={selected.has(lead.id)}
                    onChange={(e) => onSelect([lead.id], e.target.checked)}
                  />
                </td>
                <td>
                  <button className="lead-name" onClick={(e) => { e.stopPropagation(); onOpen(lead.id); }}>
                    {lead.name}
                  </button>
                  <small className="lead-company">{lead.company ?? '—'}</small>
                </td>
                <td className="nowrap">{lead.phone ?? '—'}</td>
                <td className="col-email" title={lead.email ?? undefined}>{lead.email ?? '—'}</td>
                <td><SourceChip value={lead.source} /></td>
                <td><QualifiedBadge value={lead.qualified} /></td>
                <td><TemperatureBadge value={lead.temperature} /></td>
                <td className="nowrap">{stageLabel(lead.stage)}</td>
                <td>{firstName(lead.assigned_to_name)}</td>
                <td className={`nowrap due due-${due.tone}`} title={due.title}>{due.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="skeleton" role="status" aria-label="Loading leads">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton-row" />)}
    </div>
  );
}
