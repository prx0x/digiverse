import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { getAdminEventApi, type EventBundle } from '@/api/event';

export function useEventConfig() {
  const [bundle, setBundle] = useState<EventBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getAdminEventApi();
      setBundle(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load event configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const locked = bundle?.event.status !== 'DRAFT';

  return { bundle, setBundle, loading, error, notice, setNotice, refresh, locked };
}

export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const details = err.details as { issues?: string[] } | undefined;
    if (details?.issues?.length) {
      return `${err.message}: ${details.issues.join('; ')}`;
    }
    return err.message;
  }
  return 'Unexpected error';
}
