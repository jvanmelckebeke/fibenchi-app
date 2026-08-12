import { YAHOO_HOSTS } from './endpoints';

// A plain client UA, *not* a spoofed desktop browser one. Yahoo now answers
// `v8/chart` with a hard 429 for the Chrome UA this used to send — reproducibly,
// on both query1 and query2, while the same request from this IP with any
// non-browser UA (or none) returns 200. The old comment claimed a desktop UA
// "keeps Yahoo's unofficial endpoints happy"; the opposite is true today,
// presumably because a browser UA arriving without cookies or a consent session
// looks exactly like scraping.
const USER_AGENT = 'Fibenchi-App/1.0';
const REQUEST_TIMEOUT_MS = 10_000;

// One retry, and only for *transport* failures — see `isRetryable`. Each attempt
// rotates the host, since query1/query2 serve identical data.
const MAX_RETRIES = 1;
const RETRY_BASE_MS = 400;

// Concurrency gate. A cold open of the Pulse wants ~44 daily + ~44 quotes + a
// handful of intraday series; that's fine as a total payload and not fine as 90
// simultaneous connections from one residential IP. Excess requests queue.
const MAX_CONCURRENT = 6;

// Circuit breaker on the failure *rate* over a rolling window. Counting
// consecutive failures does not work here: with a couple of dozen per-symbol
// loops in flight, partial rate-limiting interleaves successes and failures, so a
// consecutive counter never reaches its threshold and the breaker never opens
// while most requests are being rejected.
const WINDOW_MS = 30_000;
const MIN_SAMPLES = 8;
const FAILURE_RATE = 0.5;
const COOLDOWN_MS = 30_000;

/** An HTTP status Yahoo answered with — carried so retry policy can see it. */
export class YahooHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'YahooHttpError';
  }
}

/**
 * Rate-limiting and blocking are *answers*, not transport failures: retrying a
 * 429 immediately is what turns a throttled burst into a bigger throttled burst.
 * Only timeouts and connection errors get a second attempt.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof YahooHttpError) {
    // 429/403 are the throttle itself; 404 is a bad symbol, which the other host
    // will answer the same way. Only a 5xx is worth a second attempt.
    if (error.status === 429 || error.status === 403) return false;
    return error.status >= 500;
  }
  return true; // timeout / connection error — transport, so worth one retry
}

interface Outcome {
  at: number;
  ok: boolean;
}

let outcomes: Outcome[] = [];
let circuitOpenUntil = 0;
let queue: (() => void)[] = [];
let active = 0;

/** Non-200s and totals per minute — the numbers that would establish Yahoo's
 * actual unauthenticated ceiling instead of guessing at it. */
export interface RequestStats {
  windowMs: number;
  requests: number;
  failures: number;
  failureRate: number;
  circuitOpen: boolean;
  queued: number;
}

export function requestStats(): RequestStats {
  prune();
  const failures = outcomes.filter((o) => !o.ok).length;
  return {
    windowMs: WINDOW_MS,
    requests: outcomes.length,
    failures,
    failureRate: outcomes.length === 0 ? 0 : failures / outcomes.length,
    circuitOpen: Date.now() < circuitOpenUntil,
    queued: queue.length,
  };
}

function prune(): void {
  const cutoff = Date.now() - WINDOW_MS;
  outcomes = outcomes.filter((outcome) => outcome.at >= cutoff);
}

function record(ok: boolean): void {
  outcomes.push({ at: Date.now(), ok });
  prune();
  if (outcomes.length < MIN_SAMPLES) return;
  const failures = outcomes.filter((outcome) => !outcome.ok).length;
  if (failures / outcomes.length >= FAILURE_RATE) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS;
    outcomes = []; // fresh window after the cooldown, not a re-trip on old news
  }
}

/** Run `fn` with at most `MAX_CONCURRENT` requests in flight process-wide. */
async function gated<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET a path from Yahoo (host is chosen/rotated internally) and return parsed
 * JSON. Throws on exhausted retries or an open circuit; callers decide how to
 * degrade.
 */
export async function fetchYahooJson(path: string): Promise<unknown> {
  if (Date.now() < circuitOpenUntil) {
    throw new Error('yahoo: circuit open after repeated failures, backing off');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const host = YAHOO_HOSTS[attempt % YAHOO_HOSTS.length];
    try {
      const json = await gated(() => getJson(`https://${host}${path}`));
      record(true);
      return json;
    } catch (error) {
      lastError = error;
      record(false);
      if (!isRetryable(error) || attempt === MAX_RETRIES) break;
      // Jittered backoff — a synchronised retry from every symbol's loop is just
      // the original burst again, one round-trip later.
      await sleep(RETRY_BASE_MS * (1 + Math.random()));
    }
  }

  throw new Error(`yahoo: request failed: ${String(lastError)}`);
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new YahooHttpError(response.status);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** Test seam — the breaker and gate are module state by design (one client). */
export function __resetClientState(): void {
  outcomes = [];
  circuitOpenUntil = 0;
  queue = [];
  active = 0;
}
