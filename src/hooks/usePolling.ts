import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to poll an async fetch function at given intervals (default 60000ms / 1 min).
 * Stabilized against re-render storms & request flooding:
 * - Uses a ref for the fetcher function to prevent reference volatility.
 * - Deep-compares previous data to prevent unnecessary re-renders when payload hasn't changed.
 * - Concurrency guard (isFetchingRef) to prevent duplicate overlapping network requests.
 * - Dependency array tracking (deps): resets data cache and immediately re-fetches when dependencies change (e.g. selected queue or doctor ID).
 * - Pauses polling when the browser tab is hidden; throttles focus re-fetches (minimum 15s gap) to prevent flood on rapid alt-tabbing.
 * - Manual refetch resets the interval timer to guarantee a full interval gap before the next background tick.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs = 60000,
  enabled = true,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const prevDataRef = useRef<T | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const lastCompletedTimeRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  const executeFetch = useCallback(async (isInitial = false, force = false) => {
    const now = Date.now();
    // Concurrency guard: avoid overlapping network requests
    if (isFetchingRef.current) return;

    // Hard Circuit Breaker:
    // Disallow rapid-fire requests if the previous fetch completed less than 3,000ms ago.
    // If manual user click (force = true), apply a 600ms debounce guard.
    const elapsedSinceLast = now - lastCompletedTimeRef.current;
    if (!force && elapsedSinceLast < 3000) {
      return;
    }
    if (force && elapsedSinceLast < 600) {
      return;
    }

    isFetchingRef.current = true;

    try {
      if (isInitial && prevDataRef.current === null) {
        setLoading(true);
      }
      const res = await fetcherRef.current();

      if (!isMountedRef.current) return;

      // Deep compare stringified data to avoid re-rendering components if payload hasn't changed
      const prevString = JSON.stringify(prevDataRef.current);
      const nextString = JSON.stringify(res);

      if (prevString !== nextString) {
        prevDataRef.current = res;
        setData(res);
      }
      setError(null);
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Error fetching live data');
      }
    } finally {
      isFetchingRef.current = false;
      lastCompletedTimeRef.current = Date.now();
      if (isMountedRef.current && isInitial) {
        setLoading(false);
      }
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (enabled && intervalMs > 0) {
      timerRef.current = setInterval(() => {
        if (document.visibilityState !== 'hidden') {
          executeFetch(false, false);
        }
      }, intervalMs);
    }
  }, [enabled, intervalMs, executeFetch]);

  const depsKey = JSON.stringify(deps);
  const prevDepsKeyRef = useRef(depsKey);

  // Handle deps change & initial mount
  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Only reset cache when dynamic dependencies actually change (e.g. switching doctor or queue)
    if (prevDepsKeyRef.current !== depsKey) {
      prevDataRef.current = null;
      prevDepsKeyRef.current = depsKey;
    }

    executeFetch(true, false);
    resetTimer();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastCompletedTimeRef.current;
        // Throttle tab-switch re-fetches to at least 15s to prevent floods when alt-tabbing
        if (elapsed >= 15000) {
          executeFetch(false, false);
        }
        resetTimer();
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, depsKey, executeFetch, resetTimer]);

  const refetch = useCallback(() => {
    executeFetch(false, true);
    resetTimer();
  }, [executeFetch, resetTimer]);

  return { data, loading, error, refetch };
}
