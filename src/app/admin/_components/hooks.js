'use client';
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { api } from '@/lib/client/api';

/** GET an admin endpoint through react-query. Key = ['admin', path]. */
export function useAdmin(path, options = {}) {
  return useQuery({
    queryKey: ['admin', path],
    queryFn: ({ signal }) => api(path, { signal }),
    staleTime: 5_000,
    enabled: Boolean(path),
    ...options,
  });
}

/**
 * Run a mutation with toast feedback, then refresh every admin query.
 * const { run, busy } = useRunner();  run('save', () => api(...), 'Saved')
 * Resolves to the result, or undefined if it failed (the error is already shown).
 */
export function useRunner() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  const run = useCallback(
    async (key, fn, success) => {
      setBusy(key);
      try {
        const r = await fn();
        if (success) message.success(typeof success === 'function' ? success(r) : success);
        await qc.invalidateQueries({ queryKey: ['admin'] });
        return r ?? true;
      } catch (e) {
        message.error(e?.message || 'Something went wrong');
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [message, qc],
  );
  return { run, busy };
}

export { api };
