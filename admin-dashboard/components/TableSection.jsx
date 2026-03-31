export default function TableSection({ title, count, onRefresh, children, actions, loading }) {
  return (
    <div className="glass animate-in" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '18px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #172642', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{title}</h2>
          {count != null && (
            <span style={{
              background: 'rgba(255,107,43,0.12)',
              border: '1px solid rgba(255,107,43,0.2)',
              color: '#ff8a56', fontSize: 12, fontWeight: 700,
              padding: '2px 9px', borderRadius: 99,
            }}>{count}</span>
          )}
          {loading && (
            <div style={{ width: 14, height: 14, border: '2px solid #172642', borderTopColor: '#ff6b2b', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
          {onRefresh && (
            <button onClick={onRefresh} className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}>
              ↺ Refresh
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}