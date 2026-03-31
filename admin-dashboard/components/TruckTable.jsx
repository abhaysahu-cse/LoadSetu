function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

const STATUS = {
  available:    { cls: 'badge-green',  dot: 'green',  label: 'Available'    },
  in_transit:   { cls: 'badge-cyan',   dot: 'cyan',   label: 'In Transit'   },
  empty_return: { cls: 'badge-amber',  dot: 'amber',  label: 'Empty Return' },
  idle:         { cls: 'badge-orange', dot: 'orange', label: 'Idle'         },
  maintenance:  { cls: 'badge-red',    dot: 'red',    label: 'Maintenance'  },
  unknown:      { cls: 'badge-slate',  dot: 'red',    label: 'Unknown'      },
};

export default function TruckTable({ trucks = [], onForceMatch, loading }) {
  if (loading && !trucks.length) return <SkeletonTable cols={6} />;

  if (!trucks.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>🚛</div>
      <div style={{ color: '#475569', fontSize: 15 }}>No trucks found. Waiting for GPS pings...</div>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Truck ID</th>
            <th>Status</th>
            <th>Latitude</th>
            <th>Longitude</th>
            <th>H3 Cell</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {trucks.map((t, i) => {
            const st = STATUS[t.status] || STATUS.unknown;
            return (
              <tr key={t.truck_id} className="animate-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: 'rgba(255,107,43,0.1)',
                      border: '1px solid rgba(255,107,43,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, flexShrink: 0,
                    }}>🚛</div>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{t.truck_id}</span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${st.cls}`}>
                    <span className={`live-dot ${st.dot}`} style={{ width: 6, height: 6 }} />
                    {st.label}
                  </span>
                </td>
                <td><span className="mono" style={{ color: '#94a3b8' }}>{t.lat?.toFixed(5) ?? '—'}</span></td>
                <td><span className="mono" style={{ color: '#94a3b8' }}>{t.lng?.toFixed(5) ?? '—'}</span></td>
                <td><span className="mono" style={{ color: '#64748b', fontSize: 11 }}>{t.h3 ?? '—'}</span></td>
                <td style={{ color: '#64748b' }}>{timeAgo(t.last_updated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonTable({ cols }) {
  return (
    <table className="data-table">
      <thead><tr>{Array(cols).fill(0).map((_,i) => <th key={i}><div className="skeleton" style={{height:12,width:60}} /></th>)}</tr></thead>
      <tbody>
        {Array(5).fill(0).map((_,i) => (
          <tr key={i}>
            {Array(cols).fill(0).map((__,j) => (
              <td key={j}><div className="skeleton" style={{height:14,width:j===0?120:80}} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}