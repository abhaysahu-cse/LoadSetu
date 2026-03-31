import { useState, useEffect } from 'react';
import { forceMatch } from '../services/api';

const CITIES = {
  'Mumbai':    { lat: 19.0760, lng: 72.8777 },
  'Delhi':     { lat: 28.7041, lng: 77.1025 },
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Chennai':   { lat: 13.0827, lng: 80.2707 },
  'Kolkata':   { lat: 22.5726, lng: 88.3639 },
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Pune':      { lat: 18.5204, lng: 73.8567 },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Jaipur':    { lat: 26.9124, lng: 75.7873 },
  'Indore':    { lat: 22.7196, lng: 75.8577 },
  'Nagpur':    { lat: 21.1458, lng: 79.0882 },
  'Bhopal':    { lat: 23.2599, lng: 77.4126 },
  'Lucknow':   { lat: 26.8467, lng: 80.9462 },
  'Surat':     { lat: 21.1702, lng: 72.8311 },
  'Kanpur':    { lat: 26.4499, lng: 80.3319 },
};

export default function ForceMatchModal({ isOpen, onClose, prefillTruckId = '', onSuccess }) {
  const [origin,      setOrigin]      = useState('');
  const [destination,  setDestination] = useState('');
  const [weightTons,   setWeightTons]  = useState('10');
  const [loading,      setLoading]     = useState(false);
  const [result,       setResult]      = useState(null);

  useEffect(() => {
    if (!isOpen) { setResult(null); setOrigin(''); setDestination(''); setWeightTons('10'); }
  }, [isOpen]);

  if (!isOpen) return null;

  const canSubmit = origin.trim() && destination.trim() && origin !== destination && parseFloat(weightTons) > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true); setResult(null);
    try {
      const originCity = CITIES[origin];
      const destCity = CITIES[destination];

      const params = {
        origin: origin.trim(),
        destination: destination.trim(),
        weight_tons: parseFloat(weightTons),
      };
      if (originCity) {
        params.pickup_lat = originCity.lat;
        params.pickup_lng = originCity.lng;
      }

      const data = await forceMatch(params);
      setResult({ ok: true, msg: `Load queued! ID: ${data?.load_id ?? 'OK'}` });
      onSuccess?.();
      setTimeout(onClose, 2500);
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">

        {/* Header */}
        <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(255,107,43,0.15)',
                border: '1px solid rgba(255,107,43,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>⚡</div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
                Force Match
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#475569', paddingLeft: 48 }}>
              Create a load and trigger the matching engine to find nearby trucks.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: '#111e34', border: '1px solid #172642', color: '#64748b',
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', flexShrink: 0,
          }} onMouseOver={e => e.target.style.color='#e2e8f0'} onMouseOut={e => e.target.style.color='#64748b'}>
            ✕
          </button>
        </div>

        <div className="divider" style={{ margin: '20px 0 0' }} />

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
              Origin City <span style={{ color: '#f87171' }}>*</span>
            </label>
            <select
              className="ctrl-input"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <option value="">Select origin city</option>
              {Object.keys(CITIES).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
              Destination City <span style={{ color: '#f87171' }}>*</span>
            </label>
            <select
              className="ctrl-input"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <option value="">Select destination city</option>
              {Object.keys(CITIES).filter(c => c !== origin).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
              Weight (Tonnes) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              className="ctrl-input"
              type="number"
              placeholder="e.g. 10"
              min="0.1"
              max="50"
              step="0.5"
              value={weightTons}
              onChange={e => setWeightTons(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Info */}
          <div style={{
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.2)',
            borderRadius: 10, padding: '12px 16px',
            display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
            <div style={{ fontSize: 13, color: '#67e8f9', lineHeight: 1.6 }}>
              This creates a real load in the database and publishes to Kafka. The matching engine will search for nearby available trucks.
            </div>
          </div>

          {/* Result */}
          {result && (
            <div style={{
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              background: result.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${result.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
              color: result.ok ? '#4ade80' : '#f87171',
              fontSize: 14, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>{result.ok ? '✓' : '✕'}</span> {result.msg}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Footer */}
        <div style={{ padding: '18px 28px', display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary"
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {loading
              ? <><Spinner /> Processing...</>
              : <><span>⚡</span> Force Match</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}