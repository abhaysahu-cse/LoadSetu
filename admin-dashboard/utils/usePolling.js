import { useState, useEffect, useCallback } from 'react';

export function usePolling(fetcher, ms = 6000) {
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    const run = () => fetcher()
      .then(d  => { if (!dead) { setData(d); setError(null); setLoading(false); } })
      .catch(e => { if (!dead) { setError(e.message); setLoading(false); } });
    run();
    const id = setInterval(run, ms);
    return () => { dead = true; clearInterval(id); };
  }, [tick, ms]); // eslint-disable-line

  return { data, error, loading, refresh };
}