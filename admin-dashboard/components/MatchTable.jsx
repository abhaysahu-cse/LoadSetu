export default function MatchTable({ matches = [], loading }) {
  if (loading && !matches.length) return <SkeletonTable />;

  if (!matches.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>🔗</div>
      <div style={{ color: '#475569', fontSize: 15 }}>No match events from Kafka yet.</div>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Truck</th>
            <th>Matches Found</th>
            <th>Top Load</th>
            <th>Top Score</th>
            <th>Source</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m, i) => {
            const p = m.payload || {};
            const requestId = p.request_id || m.key || '—';
            const truckId = p.truck_id || '—';
            const matchList = Array.isArray(p.matches) ? p.matches : [];
            const totalFound = p.total_matches_found ?? matchList.length;
            const topMatch = matchList[0];
            const topScore = topMatch?.confidence_score;
            const isForce = m.topic === 'force-match' || p.source === 'force';

            return (
              <tr key={requestId + '-' + i} className="animate-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <td><span className="mono" style={{ fontSize: 12, color: '#64748b' }}>{requestId.slice(0, 12)}…</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="live-dot green" style={{ width: 6, height: 6 }} />
                    <span className="mono" style={{ fontSize: 13, color: '#86efac', fontWeight: 500 }}>{truckId}</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{totalFound}</span>
                </td>
                <td>
                  {topMatch
                    ? <span className="mono" style={{ fontSize: 12, color: '#e2e8f0' }}>
                        {topMatch.origin} → {topMatch.destination}
                      </span>
                    : <span style={{ color: '#475569' }}>—</span>
                  }
                </td>
                <td>
                  {topScore != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 48, height: 5, borderRadius: 99,
                        background: '#0c1526', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${topScore * 100}%`,
                          background: topScore > 0.8 ? '#4ade80' : topScore > 0.5 ? '#fbbf24' : '#f87171',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <span style={{
                        fontWeight: 700, fontSize: 13,
                        color: topScore > 0.8 ? '#4ade80' : topScore > 0.5 ? '#fbbf24' : '#f87171',
                      }}>
                        {(topScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  ) : <span style={{ color: '#475569' }}>—</span>}
                </td>
                <td>
                  <span className={`badge ${isForce ? 'badge-red' : 'badge-cyan'}`}>
                    {isForce ? '⚡ Force' : '🤖 AI'}
                  </span>
                </td>
                <td style={{ color: '#64748b', fontSize: 12 }}>
                  {m.received_at ? new Date(m.received_at).toLocaleString('en-IN', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonTable() {
  return (
    <table className="data-table">
      <thead><tr>{Array(7).fill(0).map((_,i)=><th key={i}><div className="skeleton" style={{height:12,width:70}}/></th>)}</tr></thead>
      <tbody>{Array(4).fill(0).map((_,i)=><tr key={i}>{Array(7).fill(0).map((__,j)=><td key={j}><div className="skeleton" style={{height:14,width:j===1?120:80}}/></td>)}</tr>)}</tbody>
    </table>
  );
}