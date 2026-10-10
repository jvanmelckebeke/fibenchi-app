import { companionPulseSchema, type CompanionPulse } from '@jvanmelckebeke/fibenchi-contract';

import { primeSigmaSeries } from '@/lib/compute';
import type { OhlcBar } from '@/lib/market';

export type { CompanionPulse };

/** Pulse-bundle contract version this build understands (Fibenchi's `PULSE_VERSION`). */
export const SUPPORTED_PULSE_VERSION = 1 as const;

/**
 * Past this the app stops waiting and fetches history from Yahoo itself. The
 * server pre-warms the bundle, so a slow answer means something is off, and a
 * cold open shouldn't sit on it.
 */
const PULSE_TIMEOUT_MS = 4_000;

/**
 * Fibenchi's precomputed history for the whole book, or null when there isn't
 * one to use: no endpoint, unreachable, too slow, a server that predates the
 * endpoint, a newer bundle version, or a payload the contract rejects. Every
 * failure means the same thing to the caller: fall back to Yahoo.
 */
export async function fetchPulse(endpoint: string | null): Promise<CompanionPulse | null> {
  if (!endpoint) return null;
  const url = `${endpoint.replace(/\/+$/, '')}/api/companion/pulse`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PULSE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const version = (json as { version?: unknown } | null)?.version;
    if (version !== SUPPORTED_PULSE_VERSION) return null;
    const result = companionPulseSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** ISO date → epoch seconds at midnight UTC, the day daily bars are keyed by. */
function dateToTime(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 1000;
}

/**
 * One symbol's entry as the daily bars the rest of the app reads, with its σ
 * inputs primed so `sigmaMove` scores it from the server's kernel run. The
 * series is short (40 days), which covers the Movers windows; σ only reads the
 * last two bars. Null when the entry has no closes.
 */
export function pulseBars(entry: CompanionPulse['symbols'][string]): OhlcBar[] | null {
  if (entry.closes.length === 0) return null;
  const bars: OhlcBar[] = entry.closes.map(({ date, close }) => ({
    time: dateToTime(date),
    open: close,
    high: close,
    low: close,
    close,
    adjClose: null,
    volume: null,
  }));
  // The tail must be the series' last bars; a bundle that disagrees with itself
  // is not worth scoring from.
  const lastDates = entry.closes.slice(-entry.tail.length).map((c) => c.date);
  if (entry.tail.some((point, k) => point.date !== lastDates[k])) return null;
  primeSigmaSeries(bars, entry.tail);
  return bars;
}
