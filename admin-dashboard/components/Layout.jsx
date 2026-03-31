import Sidebar from './Sidebar';

export default function Layout({ children, title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }} className="bg-mesh">
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          padding: '20px 32px',
          borderBottom: '1px solid #172642',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(7,13,26,0.8)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gap: 16,
        }}>
          <div>
            <h1 style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 22,
              fontWeight: 800,
              color: '#e2e8f0',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>{title}</h1>
            {subtitle && (
              <p style={{ fontSize: 13, color: '#475569', marginTop: 3, fontWeight: 400 }}>{subtitle}</p>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}