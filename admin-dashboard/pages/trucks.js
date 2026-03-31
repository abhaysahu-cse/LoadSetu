import { useState } from 'react';
import Layout from '../components/Layout';
import TruckTable from '../components/TruckTable';
import ForceMatchModal from '../components/ForceMatchModal';
import SectionHeader from '../components/SectionHeader';
import { usePolling } from '../utils/usePolling';
import { getTrucks } from '../services/api';

export default function TrucksPage() {
  const [filter, setFilter]       = useState('ALL');
  const [search, setSearch]       = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data, loading, error, refresh } = usePolling(getTrucks, 6000);

  const trucks = (data || []).filter(t => {
    const matchFilter = filter === 'ALL' || t.status === filter;
    const matchSearch = !search || (t.truck_id || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    ALL:        data?.length ?? 0,
    available:  data?.filter(t => t.status === 'available').length ?? 0,
    in_transit: data?.filter(t => t.status === 'in_transit').length ?? 0,
    idle:       data?.filter(t => t.status === 'idle').length ?? 0,
  };

  return (
    <Layout title="TRUCKS — LIVE MONITOR">

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <input
          className="ctrl-input"
          style={{ maxWidth: 220 }}
          placeholder="Search truck ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {['ALL','available','in_transit','idle'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded border tracking-widest transition-colors
              ${filter === s
                ? 'border-terminal-cyan text-terminal-cyan bg-terminal-dim'
                : 'border-terminal-border text-terminal-muted hover:text-terminal-text'
              }`}
          >
            {s.toUpperCase()} <span className="text-terminal-muted ml-1">({counts[s]})</span>
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setModalOpen(true)}
            className="text-xs px-4 py-2 rounded border border-terminal-red text-terminal-red
              bg-terminal-red/10 hover:bg-terminal-red/20 tracking-widest transition-colors font-bold"
          >
            ⚡ FORCE MATCH
          </button>
        </div>
      </div>

      <SectionHeader title="TRUCK REGISTRY" count={trucks.length} onRefresh={refresh} />

      {loading && !data && (
        <div className="panel p-8 text-center text-terminal-muted text-xs animate-pulse">
          FETCHING FROM REDIS...
        </div>
      )}
      {error && (
        <div className="panel p-4 text-terminal-red text-xs">✗ {error}</div>
      )}
      {!loading || data ? (
        <TruckTable
          trucks={trucks}
        />
      ) : null}

      <ForceMatchModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={refresh}
      />
    </Layout>
  );
}
