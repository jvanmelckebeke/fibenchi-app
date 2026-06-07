import { YAHOO_HOSTS } from './endpoints';

// A desktop UA keeps Yahoo's unofficial endpoints happy.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2; // attempts = MAX_RETRIES + 1; each attempt rotates the host

// Lightweight circuit breaker: after enough back-to-back failures, stop hammering
// Yahoo (and the network) for a cooldown window. Module-level state — one client.
const FAILURE_THRESHOLD = 4;
const COOLDOWN_MS = 30_000;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

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
      const json = await getJson(`https://${host}${path}`);
      consecutiveFailures = 0;
      return json;
    } catch (error) {
      lastError = error;
    }
  }

  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS;
    consecutiveFailures = 0;
  }
  throw new Error(`yahoo: request failed after ${MAX_RETRIES + 1} attempts: ${String(lastError)}`);
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
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}
