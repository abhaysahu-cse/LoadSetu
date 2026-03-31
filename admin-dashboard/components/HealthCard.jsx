export default function HealthCard({ health, loading, error }) {
  if (loading && !health) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
      {Array(6).fill(0).map((_,i) => (
        <div key={i} className="glass" style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 14, width: 80, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 36, width: 120, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 10, width: 60 }} />
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="glass" style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: '#f87171', fontWeight: 600, marginBottom: 8 }}>Health check failed</div>
      <div style={{ color: '#475569', fontSize: 13 }}>{error}</div>
    </div>
  );

  const services = [
    { key: 'backend', label: 'Spring Boot',  desc: 'Core API server',   icon: '⚙️' },
    { key: 'kafka',   label: 'Kafka Broker',  desc: 'Event streaming',   icon: '📨' },
    { key: 'redis',   label: 'Redis Cache',   desc: 'Live data & locks', icon: '⚡' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Service cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {services.map(({ key, label, desc, icon }) => {
          const ok = health?.[key];
          return (
            <div key={key} className="service-card animate-in" style={{
              borderColor: ok ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 28 }}>{icon}</div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 99,
                  background: ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                  border: `1px solid ${ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                }}>
                  <span className={`live-dot ${ok ? 'green' : 'red'}`} style={{ width: 6, height: 6 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: ok ? '#4ade80' : '#f87171' }}>
                    {ok ? 'ONLINE' : 'DOWN'}
                  </span>
                </div>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: '#475569' }}>{desc}</div>
            </div>
          );
        })}
      </div>

      {/* Metrics row */}
      {health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <MetricCard label="Uptime" value={health.uptime ?? 'N/A'} icon="⏱️" color="#ff6b2b" />
          <MetricCard label="DB Pool" value={`${health.dbPool ?? 0} / 20`} icon="🗄️" color="#22d3ee" bar={health.dbPool ? health.dbPool / 20 : 0} />
          <MetricCard label="Active Drivers" value={health.activeDrivers ?? 0} icon="👤" color="#4ade80" />
        </div>
      )}

      {/* Raw dump */}
      {health && (
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Raw Response
          </div>
          <pre style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b', lineHeight: 1.7, overflow: 'auto' }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color, bar }) {
  return (
    <div className="glass animate-in" style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</div>
      {bar != null && (
        <div style={{ marginTop: 12 }}>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${bar * 100}%`, background: color }} />
          </div>
        </div>
      )}
    </div>
  );
}