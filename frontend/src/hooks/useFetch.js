import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api';

/**
 * Load data from an API function with loading / error / refetch handling.
 *   const { data, loading, error, refetch } = useFetch(() => ProductAPI.list(params), [params.page]);
 */
export default function useFetch(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reqId = useRef(0);

  const run = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fnRef.current();
      if (id === reqId.current) setData(res);
      return res;
    } catch (err) {
      if (id === reqId.current) setError(errorMessage(err));
      return null;
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, refetch: run };
}
