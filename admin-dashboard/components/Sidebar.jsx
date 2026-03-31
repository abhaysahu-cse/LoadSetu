import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getHealth } from '../services/api';

const NAV = [
  { href: '/',        label: 'Overview',  icon: OverviewIcon  },
  { href: '/trucks',  label: 'Trucks',    icon: TruckIcon     },
  { href: '/loads',   label: 'Loads',     icon: LoadIcon      },
  { href: '/matches', label: 'Matches',   icon: MatchIcon     },
  { href: '/health',  label: 'Health',    icon: HealthIcon    },
];

export default function Sidebar() {
  const router = useRouter();
  const [health, setHealth] = useState(null);
  const [time,   setTime]   = useState('');

  useEffect(() => {
    const fetchH = () => getHealth().then(setHealth).catch(() => {});
    fetchH();
    const hid = setInterval(fetchH, 8000);
    const tid = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    }, 1000);
    setTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    return () => { clearInterval(hid); clearInterval(tid); };
  }, []);

  const allOk = health?.kafka && health?.redis && health?.backend;

  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #070d1a 0%, #040812 100%)',
      borderRight: '1px solid #172642',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>

      {/* Brand */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #172642' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #ff6b2b, #e85520)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(255,107,43,0.4)',
            fontSize: 17, flexShrink: 0,
          }}>🚛</div>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              LoadSetu
            </div>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Admin Control
            </div>
          </div>
        </div>
      </div>

      {/* System status pill */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #172642' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 99,
          background: allOk ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
          border: `1px solid ${allOk ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
        }}>
          <span className={`live-dot ${allOk ? 'green' : 'red'}`} />
          <span style={{ fontSize: 12, fontWeight: 600, color: allOk ? '#4ade80' : '#f87171' }}>
            {health === null ? 'Connecting...' : allOk ? 'All Systems Go' : 'Issue Detected'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 10px' }}>
          Navigation
        </div>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = router.pathname === href;
          return (
            <a key={href} href={href} style={{ display: 'block', textDecoration: 'none', marginBottom: 2 }}>
              <div className={`nav-item ${active ? 'active' : ''}`}>
                <Icon active={active} />
                <span>{label}</span>
                {active && (
                  <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#ff6b2b' }} />
                )}
              </div>
            </a>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #172642' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>System Time</span>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>{time}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          {[
            { label: 'K', ok: health?.kafka,   title: 'Kafka' },
            { label: 'R', ok: health?.redis,    title: 'Redis' },
            { label: 'B', ok: health?.backend,  title: 'Backend' },
          ].map(({ label, ok, title }) => (
            <div key={label} title={title} style={{
              flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 8,
              background: ok ? 'rgba(74,222,128,0.08)' : ok === false ? 'rgba(248,113,113,0.08)' : '#0c1526',
              border: `1px solid ${ok ? 'rgba(74,222,128,0.2)' : ok === false ? 'rgba(248,113,113,0.2)' : '#172642'}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: ok ? '#4ade80' : ok === false ? '#f87171' : '#475569' }}>{label}</div>
              <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>{ok ? 'UP' : ok === false ? 'DOWN' : '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ── SVG Icons ─────────────────────────────────────────────────────────── */
const ic = (active) => ({ color: active ? '#ff6b2b' : '#64748b', transition: 'color 0.18s' });

function OverviewIcon({ active }) {
  return <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={ic(active).color} strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>;
}
function TruckIcon({ active }) {
  return <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={ic(active).color} strokeWidth="2">
    <path d="M1 3h13v13H1zM14 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>;
}
function LoadIcon({ active }) {
  return <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={ic(active).color} strokeWidth="2">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>;
}
function MatchIcon({ active }) {
  return <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={ic(active).color} strokeWidth="2">
    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
  </svg>;
}
function HealthIcon({ active }) {
  return <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={ic(active).color} strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>;
}