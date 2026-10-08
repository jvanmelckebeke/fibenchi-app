import {
  companionPortfolioIndexSchema,
  type CompanionPortfolioIndex,
} from '@jvanmelckebeke/fibenchi-contract';

export type { CompanionPortfolioIndex };

/** Portfolio-index contract version this build understands (Fibenchi's `PORTFOLIO_INDEX_VERSION`). */
export const SUPPORTED_PORTFOLIO_INDEX_VERSION = 1 as const;

/**
 * Fibenchi's equal-weight portfolio index, or null when there isn't one to show:
 * no endpoint, unreachable, a server that predates the endpoint (404), a newer
 * bundle version, or a payload the contract rejects. The index is a nice-to-have
 * on the Pulse, so every failure collapses to "no card" rather than an error.
 */
export async function fetchPortfolioIndex(
  endpoint: string | null,
  period = '1y'
): Promise<CompanionPortfolioIndex | null> {
  if (!endpoint) return null;
  const url = `${endpoint.replace(/\/+$/, '')}/api/companion/portfolio-index?period=${period}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const version = (json as { version?: unknown } | null)?.version;
    if (version !== SUPPORTED_PORTFOLIO_INDEX_VERSION) return null;
    const result = companionPortfolioIndexSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
