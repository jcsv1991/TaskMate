import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run an async function, track loading/error state, and expose `reload`.
 *
 * Responses that arrive out of order are discarded: if the user types "ab" and
 * the request for "a" finishes after the one for "ab", the stale result must not
 * overwrite the newer one (the original search box had this race).
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === latest.current) setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (id === latest.current) setState((s) => ({ ...s, loading: false, error }));
      return undefined;
    }
    // `deps` is supplied by the caller (the values that should trigger a refetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      latest.current += 1; // ignore anything still in flight after unmount
    };
  }, [run]);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
