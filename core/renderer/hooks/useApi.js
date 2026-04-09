import { useState, useEffect, useCallback } from 'react';
import { apiClient } from './apiClient';

/**
 * useApi — data fetching hook for GET requests.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi('/api/web-manager/projects');
 *
 * - data    → null until loaded, then response.data value
 * - loading → true during fetch
 * - error   → null if ok, error string if failed
 * - refetch → call to re-run the fetch
 */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiClient.get(path);
    if (result.error) {
      setError(result.error);
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, [path]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
