import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { endOfToday, followUp, initials } from '../lib/format';
import { LEADS_KEY } from '../lib/queries';

interface Props {
  search: string;
  onSearch: (value: string) => void;
  onOpenLead: (id: number) => void;
}

function Reminders({ onOpenLead }: Pick<Props, 'onOpenLead'>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reminders = useQuery({
    queryKey: [LEADS_KEY, 'reminders'],
    queryFn: () => api.reminders(endOfToday()),
    refetchInterval: 60_000,
  });
  const leads = reminders.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="reminders" ref={root}>
      <button
        className="icon-btn"
        aria-label={`Follow-ups due today: ${leads.length}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} aria-hidden="true" />
        {leads.length > 0 && <span className="icon-badge">{leads.length > 9 ? '9+' : leads.length}</span>}
      </button>
      {open && (
        <div className="popover">
          <h3>Follow-ups due</h3>
          {leads.length === 0 && <p className="muted popover-empty">Nothing due today.</p>}
          <ul>
            {leads.map((lead) => {
              const due = followUp(lead);
              return (
                <li key={lead.id}>
                  <button onClick={() => { setOpen(false); onOpenLead(lead.id); }}>
                    <span>
                      <strong>{lead.name}</strong>
                      <small>{lead.company ?? lead.phone}</small>
                    </span>
                    <span className={`due due-${due.tone}`}>{due.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Topbar({ search, onSearch, onOpenLead }: Props) {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>CRM</h1>
        <p>All leads from every source in one place</p>
      </div>
      <label className="search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search leads…"
          aria-label="Search leads by name, company, phone or email"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>
      <div className="topbar-actions">
        <Reminders onOpenLead={onOpenLead} />
        <div className="user-chip">
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <span className="user-text">
            <strong>{user.name}</strong>
            <small>{user.role === 'owner' ? 'Owner' : 'Sales rep'}</small>
          </span>
        </div>
        <button className="btn" onClick={logout}>
          <LogOut size={16} aria-hidden="true" />
          <span className="logout-label">Logout</span>
        </button>
      </div>
    </header>
  );
}
