import { useState } from 'react';
import Layout from '../components/Layout';
import LoadTable from '../components/LoadTable';
import SectionHeader from '../components/SectionHeader';
import { usePolling } from '../utils/usePolling';
import { getLoads } from '../services/api';

export default function LoadsPage() {
  const [search, setSearch] = useState('');

  const { data, loading, error, refresh } = usePolling(getLoads, 8000);

  const loads = (data || []).filter(l => {
    const p = l.payload || l;
    const matchSearch = !search ||
      (p.loadId || p.load_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.origin || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.destination || '').toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <Layout title="LOADS — MONITOR">

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          className="ctrl-input"
          style={{ maxWidth: 240 }}
          placeholder="Search by ID, origin, destination..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <SectionHeader title="RECENT LOAD EVENTS" count={loads.length} onRefresh={refresh} />

      {loading && !data && (
        <div className="panel p-8 text-center text-terminal-muted text-xs animate-pulse">
          LOADING...
        </div>
      )}
      {error && <div className="panel p-4 text-terminal-red text-xs">✗ {error}</div>}
      {(!loading || data) && (
        <LoadTable loads={loads} />
      )}
    </Layout>
  );
}
