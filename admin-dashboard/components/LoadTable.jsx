export default function LoadTable({ loads = [], loading }) {
  if (loading && !loads.length) return <SkeletonTable cols={5} />;

  if (!loads.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📦</div>
      <div style={{ color: '#475569', fontSize: 15 }}>No load events yet. Create one via Force Match.</div>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Load ID</th>
            <th>Route</th>
            <th>Weight</th>
            <th>Source</th>
            <th>Coordinates</th>
          </tr>
        </thead>
        <tbody>
          {loads.map((l, i) => {
            const id = l.loadId || l.load_id || '—';
            const origin = l.origin || l.originName || '—';
            const dest = l.destination || l.destinationName || '—';
            const weight = l.weightTons || l.weight_tons || l.requiredCapacity;
            const source = l.source || '—';
            const lat = l.pickupLat || l.pickup_lat;
            const lng = l.pickupLng || l.pickup_lng;
            return (
              <tr key={id + '-' + i} className="animate-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <td>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0' }}>
                    {id.length > 12 ? id.slice(0, 12) + '…' : id}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{origin}</span>
                    <span style={{ color: '#334155', fontSize: 12 }}>→</span>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{dest}</span>
                  </div>
                </td>
                <td>
                  {weight
                    ? <span style={{ fontWeight: 600, color: '#fbbf24' }}>{weight}<span style={{ color: '#475569', fontWeight: 400 }}> T</span></span>
                    : <span style={{ color: '#475569' }}>—</span>
                  }
                </td>
                <td>
                  <span className={`badge ${source === 'admin-force-match' ? 'badge-orange' : 'badge-cyan'}`}>
                    {source}
                  </span>
                </td>
                <td>
                  {lat && lng
                    ? <span className="mono" style={{ fontSize: 11, color: '#64748b' }}>{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</span>
                    : <span style={{ color: '#475569' }}>—</span>
                  }
                </td>
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
      <thead><tr>{Array(cols).fill(0).map((_,i)=><th key={i}><div className="skeleton" style={{height:12,width:70}}/></th>)}</tr></thead>
      <tbody>{Array(5).fill(0).map((_,i)=><tr key={i}>{Array(cols).fill(0).map((__,j)=><td key={j}><div className="skeleton" style={{height:14,width:j===1?160:80}}/></td>)}</tr>)}</tbody>
    </table>
  );
}

