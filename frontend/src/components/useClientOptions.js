import { clients } from '../services/endpoints';
import { useAsync } from '../hooks/useAsync';

/** All of the user's clients (up to the API's page limit), for dropdowns and filters. */
export function useClientOptions(enabled = true) {
  const { data, loading, error } = useAsync(
    () => (enabled ? clients.list({ limit: 100, sortBy: 'name' }).then((r) => r.items) : Promise.resolve([])),
    [enabled]
  );
  return { clients: data || [], loading, error };
}
