import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BulkBar } from '../components/BulkBar';
import { FilterBar } from '../components/FilterBar';
import { ImportDialog } from '../components/ImportDialog';
import { KanbanBoard } from '../components/KanbanBoard';
import { LeadDrawer } from '../components/LeadDrawer';
import { LeadForm } from '../components/LeadForm';
import { LeadsTable, TableSkeleton, type Sort } from '../components/LeadsTable';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { api, type ListParams } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LEADS_KEY, useInvalidateLeads } from '../lib/queries';
import type { Lead, LeadFilters, LeadInput, LeadList, SortField, Stage } from '../types';

type View = 'table' | 'kanban';

const VIEW_KEY = 'crm_view';
const PAGE_SIZE = 25;
const BOARD_LIMIT = 500;

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'kanban' ? 'kanban' : 'table';
  } catch {
    return 'table';
  }
}

function saveView(view: View) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // storage blocked: the choice just isn't remembered
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface Props {
  search: string;
  openLeadId: number | null;
  onOpenLead: (id: number | null) => void;
}

export function LeadsPage({ search, openLeadId, onOpenLead }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const client = useQueryClient();
  const invalidate = useInvalidateLeads();

  const [view, setView] = useState<View>(savedView);
  const [filters, setFilters] = useState<LeadFilters>({});
  const [sort, setSort] = useState<Sort>({ field: 'created_at', order: 'desc' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<'add' | 'import' | null>(null);
  const [exporting, setExporting] = useState(false);

  const activeFilters = useMemo(() => ({ ...filters, q: search || undefined }), [filters, search]);
  const hasFilters = Object.values(activeFilters).some(Boolean);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [activeFilters]);

  const tableParams: ListParams = {
    ...activeFilters, sort: sort.field, order: sort.order, page, page_size: PAGE_SIZE,
  };
  const table = useQuery({
    queryKey: [LEADS_KEY, 'table', tableParams],
    queryFn: () => api.leads(tableParams),
    placeholderData: keepPreviousData,
    enabled: view === 'table',
  });

  const boardParams: ListParams = {
    ...activeFilters, sort: 'next_follow_up', order: 'asc', page_size: BOARD_LIMIT,
  };
  const board = useQuery({
    queryKey: [LEADS_KEY, 'board', boardParams],
    queryFn: () => api.leads(boardParams),
    placeholderData: keepPreviousData,
    enabled: view === 'kanban',
  });

  const current = view === 'table' ? table : board;
  const total = current.data?.total ?? 0;
  const shown = current.data?.items.length ?? 0;
  const summary = current.data ? `Showing ${shown} of ${total} ${total === 1 ? 'lead' : 'leads'}` : '';
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const moveLead = useMutation({
    mutationFn: ({ lead, stage }: { lead: Lead; stage: Stage }) => api.updateLead(lead.id, { stage }),
    onMutate: async ({ lead, stage }) => {
      const key = [LEADS_KEY, 'board'];
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueriesData<LeadList>({ queryKey: key });
      client.setQueriesData<LeadList>({ queryKey: key }, (data) =>
        data && { ...data, items: data.items.map((item) => (item.id === lead.id ? { ...item, stage } : item)) },
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      context?.previous.forEach(([key, data]) => client.setQueryData(key, data));
      toast(error.message, 'error');
    },
    onSettled: invalidate,
  });

  const changeFilters = (changes: Partial<LeadFilters>) => setFilters((f) => ({ ...f, ...changes }));

  const changeView = (next: View) => {
    setView(next);
    saveView(next);
    setSelected(new Set());
  };

  const changeSort = (field: SortField) => {
    setSort((s) => ({
      field,
      order: s.field === field && s.order === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  const changeSelection = (ids: number[], checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const exportLeads = async () => {
    setExporting(true);
    try {
      downloadBlob(await api.exportLeads({ ...activeFilters, sort: sort.field, order: sort.order }), 'leads.xlsx');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const addLead = async (input: LeadInput) => {
    await api.createLead(input);
    await invalidate();
    setDialog(null);
    toast(`${input.name} added`);
  };

  const empty = current.isSuccess && total === 0;

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <h2>Leads</h2>
          <div className="segmented" role="group" aria-label="View">
            {(['table', 'kanban'] as const).map((option) => (
              <button
                key={option}
                className={view === option ? 'active' : ''}
                aria-pressed={view === option}
                onClick={() => changeView(option)}
              >
                {option === 'table' ? 'Table' : 'Kanban'}
              </button>
            ))}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-lg" onClick={() => setDialog('import')}>Import</button>
          <button className="btn btn-lg" onClick={exportLeads} disabled={exporting || total === 0}>
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button className="btn btn-lg btn-primary" onClick={() => setDialog('add')}>
            <Plus size={18} aria-hidden="true" />
            Add lead
          </button>
        </div>
      </div>

      <FilterBar filters={filters} onChange={changeFilters} summary={summary} />

      {view === 'table' && selected.size > 0 && (
        <BulkBar ids={[...selected]} onClear={() => setSelected(new Set())} />
      )}

      {current.isError && (
        <div className="card state">
          <h3>Couldn't load leads</h3>
          <p className="muted">{current.error.message}</p>
          <button className="btn" onClick={() => current.refetch()}>Try again</button>
        </div>
      )}

      {current.isPending && <div className="card"><TableSkeleton /></div>}

      {empty && (
        <div className="card state">
          {hasFilters ? (
            <>
              <h3>No leads match</h3>
              <p className="muted">Try a different search or remove some filters.</p>
              {Object.values(filters).some(Boolean) && (
                <button className="btn" onClick={() => setFilters({})}>Clear filters</button>
              )}
            </>
          ) : (
            <>
              <h3>No leads yet</h3>
              <p className="muted">Import your Excel sheet or add your first lead.</p>
              <div className="state-actions">
                <button className="btn" onClick={() => setDialog('import')}>Import</button>
                <button className="btn btn-primary" onClick={() => setDialog('add')}>Add lead</button>
              </div>
            </>
          )}
        </div>
      )}

      {view === 'table' && table.data && !empty && (
        <>
          <div className="card table-card">
            <LeadsTable
              leads={table.data.items}
              sort={sort}
              onSort={changeSort}
              selected={selected}
              onSelect={changeSelection}
              onOpen={onOpenLead}
            />
          </div>
          {lastPage > 1 && (
            <nav className="pagination" aria-label="Pages">
              <button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page} of {lastPage}</span>
              <button className="btn" disabled={page === lastPage} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          )}
        </>
      )}

      {view === 'kanban' && board.data && !empty && (
        <>
          {total > shown && (
            <p className="notice">The board shows {shown} of {total} leads. Use filters to narrow it down.</p>
          )}
          <KanbanBoard
            leads={board.data.items}
            onOpen={onOpenLead}
            onMove={(lead, stage) => moveLead.mutate({ lead, stage })}
          />
        </>
      )}

      {dialog === 'add' && user && (
        <Modal title="Add lead" onClose={() => setDialog(null)}>
          <LeadForm defaultAssignee={user.id} submitLabel="Add lead" onSubmit={addLead} />
        </Modal>
      )}
      {dialog === 'import' && <ImportDialog onClose={() => setDialog(null)} />}
      {openLeadId !== null && (
        <LeadDrawer key={openLeadId} leadId={openLeadId} onClose={() => onOpenLead(null)} />
      )}
    </>
  );
}
