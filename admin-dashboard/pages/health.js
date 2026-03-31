import Layout from '../components/Layout';
import HealthCard from '../components/HealthCard';
import SectionHeader from '../components/SectionHeader';
import { usePolling } from '../utils/usePolling';
import { getHealth } from '../services/api';

export default function HealthPage() {
  const { data, loading, error, refresh } = usePolling(getHealth, 5000);

  return (
    <Layout title="SYSTEM HEALTH">

      <SectionHeader title="SERVICE STATUS" onRefresh={refresh} />

      <HealthCard health={data} loading={loading} error={error} />

      {/* Raw JSON dump for debugging */}
      {data && (
        <div className="mt-6">
          <div className="text-terminal-muted text-xs tracking-widest mb-2">RAW RESPONSE</div>
          <div className="panel p-4">
            <pre className="text-terminal-muted text-xs leading-relaxed overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Polling indicator */}
      <div className="mt-4 text-terminal-muted text-xs flex items-center gap-2">
        <span className="dot-green animate-pulse-slow" />
        Auto-refreshing every 5 seconds
      </div>
    </Layout>
  );
}
