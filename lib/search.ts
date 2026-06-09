import { useEffect, useMemo, useState } from 'react';

import { type CompanionConfig } from '@/lib/config';
import { market, type SymbolSearchResult } from '@/lib/market';

const YAHOO_DEBOUNCE_MS = 400;
const LOCAL_LIMIT = 8;

/**
 * Filter the synced watchlist (config tickers) by symbol or name. Instant and
 * offline — the watchlist *is* our local symbol index (there's no server-side
 * directory like the web app has). Ranked exact-symbol → symbol-prefix →
 * symbol-substring → name-only, then alphabetically, capped at `limit`.
 */
export function localSymbolSearch(
  config: CompanionConfig | null,
  query: string,
  limit = LOCAL_LIMIT
): SymbolSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!config || q.length === 0) return [];
  const tickers = config.tickers ?? {};

  const scored: { result: SymbolSearchResult; score: number }[] = [];
  for (const [symbol, meta] of Object.entries(tickers)) {
    const sym = symbol.toLowerCase();
    const name = (meta.name ?? '').toLowerCase();
    const symHit = sym.includes(q);
    const nameHit = name.includes(q);
    if (!symHit && !nameHit) continue;
    const score = sym === q ? 0 : sym.startsWith(q) ? 1 : symHit ? 2 : 3;
    scored.push({
      result: { symbol, name: meta.name ?? symbol, exchange: null, type: 'other', tracked: true },
      score,
    });
  }
  scored.sort((a, b) => a.score - b.score || a.result.symbol.localeCompare(b.result.symbol));
  return scored.slice(0, limit).map((entry) => entry.result);
}

export interface SymbolSearchState {
  /** Watchlist matches — synchronous, no network. */
  local: SymbolSearchResult[];
  /** Yahoo matches not already in `local` — debounced network call. */
  yahoo: SymbolSearchResult[];
  /** A Yahoo request is in flight (local is never "loading"). */
  loading: boolean;
}

/**
 * Two-phase symbol search mirroring `../fibenchi`: local watchlist hits appear
 * instantly while a debounced Yahoo query fills in everything else below,
 * deduped against the local set. `config` is passed in (not read from context)
 * to keep this a plain hook over its inputs.
 */
export function useSymbolSearch(query: string, config: CompanionConfig | null): SymbolSearchState {
  const trimmed = query.trim();
  const local = useMemo(() => localSymbolSearch(config, trimmed), [config, trimmed]);
  const [yahoo, setYahoo] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (trimmed.length === 0) {
      setYahoo([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      market
        .searchSymbols(trimmed)
        .then((results) => {
          if (cancelled) return;
          const localSyms = new Set(local.map((r) => r.symbol.toLowerCase()));
          setYahoo(results.filter((r) => !localSyms.has(r.symbol.toLowerCase())));
        })
        .catch(() => {
          if (!cancelled) setYahoo([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, YAHOO_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, local]);

  return { local, yahoo, loading };
}
