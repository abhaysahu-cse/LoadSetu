export default function StatCard({ label, value, sub, icon, color = 'orange', trend, loading }) {
  return (
    <div className={`stat-card ${color} animate-in`} style={{ cursor: 'default' }}>
      {/* Icon + Label row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: getBg(color),
          border: `1px solid ${getBorder(color)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 19,
        }}>
          {icon}
        </div>
        {trend != null && (
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: trend >= 0 ? '#4ade80' : '#f87171',
            background: trend >= 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            padding: '3px 8px', borderRadius: 99,
          }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </div>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <div className="skeleton" style={{ height: 38, width: 80, marginBottom: 8 }} />
      ) : (
        <div style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 38,
          fontWeight: 800,
          color: getColor(color),
          lineHeight: 1,
          marginBottom: 6,
          letterSpacing: '-0.02em',
        }}>
          {value ?? '—'}
        </div>
      )}

      {/* Label */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: sub ? 4 : 0 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#475569' }}>{sub}</div>}
    </div>
  );
}

function getBg(c) {
  const m = { orange:'rgba(255,107,43,0.1)', cyan:'rgba(34,211,238,0.1)', green:'rgba(74,222,128,0.1)', red:'rgba(248,113,113,0.1)', amber:'rgba(251,191,36,0.1)' };
  return m[c] || m.orange;
}
function getBorder(c) {
  const m = { orange:'rgba(255,107,43,0.25)', cyan:'rgba(34,211,238,0.25)', green:'rgba(74,222,128,0.25)', red:'rgba(248,113,113,0.25)', amber:'rgba(251,191,36,0.25)' };
  return m[c] || m.orange;
}
function getColor(c) {
  const m = { orange:'#ff8a56', cyan:'#67e8f9', green:'#86efac', red:'#fca5a5', amber:'#fde68a' };
  return m[c] || m.orange;
}