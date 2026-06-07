import { DEFAULT_ENDPOINT } from './constants';
import { safeDecodeConfig, type DecodeResult } from './index';

/**
 * Fetch + decode the config bundle from a Fibenchi endpoint. Network/HTTP errors
 * surface as `{ ok: false, reason: 'invalid' }` so callers handle one shape.
 */
export async function fetchConfig(endpoint: string = DEFAULT_ENDPOINT): Promise<DecodeResult> {
  if (!endpoint) {
    return { ok: false, reason: 'invalid', error: 'No Fibenchi endpoint configured.' };
  }
  const url = `${endpoint.replace(/\/+$/, '')}/api/companion/config`;
  let json: unknown;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false, reason: 'invalid', error: `HTTP ${res.status} from ${url}` };
    json = await res.json();
  } catch (error) {
    return { ok: false, reason: 'invalid', error: `Could not reach ${url}: ${String(error)}` };
  }
  return safeDecodeConfig(json);
}
