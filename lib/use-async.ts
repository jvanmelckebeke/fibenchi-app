import { useEffect, useState } from 'react';

/**
 * Latest result of an async fetch, `null` while loading — with the cancellation
 * handshake (ignore a resolution that lands after unmount or a dep change) done
 * once here instead of hand-rolled per effect. The result resets to `null` the
 * moment `deps` change, so `result != null` doubles as "this data belongs to the
 * *current* deps" — no separate which-request-was-this bookkeeping. Rejections
 * resolve to `null` (market fetches already degrade to empty UI states).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): T | null {
  const [result, setResult] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    fn().then(
      (value) => {
        if (!cancelled) setResult(value);
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
    // The caller's dep list *is* the contract — `fn` is intentionally re-read
    // only when deps change (it's an inline closure at every call site).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}
