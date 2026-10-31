import { useEffect, useState } from 'react';
import { Topbar } from './components/Topbar';
import { useAuth } from './lib/auth';
import { LeadsPage } from './pages/Leads';
import { LoginPage } from './pages/Login';

const SEARCH_DELAY_MS = 300;

export default function App() {
  const { user, loading } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [openLeadId, setOpenLeadId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  if (loading) return <div className="splash" role="status">Loading…</div>;
  if (!user) return <LoginPage />;

  return (
    <div className="shell">
      <Topbar search={searchText} onSearch={setSearchText} onOpenLead={setOpenLeadId} />
      <main className="content">
        <LeadsPage search={search} openLeadId={openLeadId} onOpenLead={setOpenLeadId} />
      </main>
    </div>
  );
}
