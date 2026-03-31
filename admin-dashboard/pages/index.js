import { useState } from 'react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import TruckTable from '../components/TruckTable';
import LoadTable from '../components/LoadTable';
import MatchTable from '../components/MatchTable';
import ForceMatchModal from '../components/ForceMatchModal';
import SectionHeader from '../components/SectionHeader';
import { usePolling } from '../utils/usePolling';
import { getTrucks, getLoads, getMatches } from '../services/api';

export default function OverviewPage() {
  const [modalOpen, setModalOpen] = useState(false);

  const trucks  = usePolling(getTrucks,  8000);
  const loads   = usePolling(getLoads,   10000);
  const matches = usePolling(getMatches, 12000);

  const onlineTrucks   = trucks.data?.filter(t => t.status === 'available' || t.status === 'in_transit').length ?? 0;
  const totalLoads     = loads.data?.length ?? 0;
  const todayMatches   = matches.data?.length ?? 0;

  const handleAssign = () => {
    setModalOpen(true);
  };

  return (
    <Layout title="OVERVIEW — MISSION CONTROL">

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="TRUCKS ONLINE"
          value={trucks.loading ? '...' : onlineTrucks}
          sub={`of ${trucks.data?.length ?? 0} total`}
          color="text-terminal-green"
          icon="▣"
        />
        <StatCard
          label="RECENT LOADS"
          value={loads.loading ? '...' : totalLoads}
          sub="from Kafka buffer"
          color="text-terminal-amber"
          icon="⬡"
        />
        <StatCard
          label="MATCHES TODAY"
          value={matches.loading ? '...' : todayMatches}
          color="text-terminal-cyan"
          icon="⇌"
        />
        <div className="panel p-5 flex flex-col justify-between">
          <div className="text-terminal-muted text-xs tracking-widest">FORCE MATCH</div>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-3 w-full py-2.5 text-xs font-bold tracking-widest rounded
              bg-terminal-red/10 border border-terminal-red text-terminal-red
              hover:bg-terminal-red/20 transition-colors"
          >
            ⚡ FORCE MATCH
          </button>
        </div>
      </div>

      {/* ── Live Trucks ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader
          title="LIVE TRUCK MONITOR"
          count={trucks.data?.length}
          onRefresh={trucks.refresh}
        />
        {trucks.error
          ? <ErrorPanel msg={trucks.error} />
          : <TruckTable trucks={trucks.data || []} onForceMatch={() => setModalOpen(true)} />
        }
      </div>

      {/* ── Loads ────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader
          title="RECENT LOADS"
          count={loads.data?.length}
          onRefresh={loads.refresh}
        />
        {loads.error
          ? <ErrorPanel msg={loads.error} />
          : <LoadTable loads={loads.data || []} />
        }
      </div>

      {/* ── Matches ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader
          title="MATCH RESULTS"
          count={matches.data?.length}
          onRefresh={matches.refresh}
        />
        {matches.error
          ? <ErrorPanel msg={matches.error} />
          : <MatchTable matches={matches.data || []} />
        }
      </div>

      <ForceMatchModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { loads.refresh(); matches.refresh(); }}
      />
    </Layout>
  );
}

function ErrorPanel({ msg }) {
  return (
    <div className="panel p-4 text-terminal-red text-xs border-terminal-red/30">
      ✗ {msg} — is Spring Boot running on :8080?
    </div>
  );
}
