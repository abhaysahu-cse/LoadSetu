import { useState } from 'react';
import Layout from '../components/Layout';
import MatchTable from '../components/MatchTable';
import ForceMatchModal from '../components/ForceMatchModal';
import SectionHeader from '../components/SectionHeader';
import { usePolling } from '../utils/usePolling';
import { getMatches } from '../services/api';

export default function MatchesPage() {
  const [modalOpen, setModalOpen] = useState(false);

  const { data, loading, error, refresh } = usePolling(getMatches, 10000);

  return (
    <Layout title="MATCHES — AI + MANUAL">

      <div className="flex items-center gap-3 mb-5">
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

      <SectionHeader title="MATCH RESULTS" count={data?.length ?? 0} onRefresh={refresh} />

      {loading && !data && (
        <div className="panel p-8 text-center text-terminal-muted text-xs animate-pulse">
          LOADING MATCHES...
        </div>
      )}
      {error && <div className="panel p-4 text-terminal-red text-xs">✗ {error}</div>}
      {(!loading || data) && <MatchTable matches={data || []} />}

      <ForceMatchModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={refresh}
      />
    </Layout>
  );
}
