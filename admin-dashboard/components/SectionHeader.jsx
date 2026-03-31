export default function SectionHeader({ title, count, onRefresh, lastUpdated, children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <h2 className="text-terminal-bright text-xs font-display tracking-widest">{title}</h2>
        {count != null && (
          <span className="badge badge-blue">{count}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-terminal-muted text-xs">
            updated {lastUpdated}
          </span>
        )}
        {children}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-terminal-muted hover:text-terminal-cyan border border-terminal-border
              hover:border-terminal-cyan px-3 py-1.5 rounded transition-colors tracking-widest"
          >
            ↺ REFRESH
          </button>
        )}
      </div>
    </div>
  );
}
