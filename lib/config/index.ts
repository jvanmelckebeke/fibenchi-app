import { companionConfigSchema, type CompanionConfig } from '@jvanmelckebeke/fibenchi-contract';

export type { CompanionConfig };

/**
 * Config-contract version this app build understands. Must match Fibenchi's
 * `CONFIG_VERSION`. The contract's schema also pins it via `z.literal(...)`.
 */
export const SUPPORTED_CONFIG_VERSION = 1 as const;

/** A single group from the decoded bundle. */
export type ConfigGroup = NonNullable<CompanionConfig['groups']>[number];

/**
 * Groups in display order: the **default group (Watchlist) first**, then the
 * rest by the backend's `position`.
 *
 * The bundle arrives ordered by `(position, name)` alone, and the default group
 * carries whatever position it happened to get when the custom groups were
 * reordered — in practice the last one. Fibenchi's own sidebar pins the default
 * above the custom groups (`groups-section.tsx`); this keeps the app on the same
 * rule instead of inheriting a raw position that was never maintained for it.
 */
export function orderedGroups(config: CompanionConfig | null): ConfigGroup[] {
  const groups = config?.groups ?? [];
  return [...groups].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.position - b.position
  );
}

/**
 * The whole book, deduped across groups in display order. A symbol in three
 * groups is one symbol here: σ-Move and the poll loop belong to the asset, not
 * to the group.
 */
export function bookSymbols(config: CompanionConfig | null): string[] {
  const seen = new Set<string>();
  for (const group of orderedGroups(config)) {
    for (const symbol of group.symbols ?? []) seen.add(symbol);
  }
  return [...seen];
}

/**
 * Every symbol the app tracks: the book plus thesis members in no group, which
 * the Board shows when grouped by thesis. Polling and daily bars cover this set,
 * so flipping the toggle has its numbers already.
 */
export function trackedSymbols(config: CompanionConfig | null): string[] {
  const seen = new Set(bookSymbols(config));
  for (const thesis of config?.theses ?? []) {
    for (const symbol of thesis.symbols ?? []) seen.add(symbol);
  }
  return [...seen];
}

export interface SymbolSection {
  title: string;
  symbols: string[];
  /** Thesis colour, for the section's accent. */
  accent?: string | null;
}

/** The Board's group sections, in display order. */
export function groupSections(config: CompanionConfig | null): SymbolSection[] {
  return orderedGroups(config).map((g) => ({ title: g.name, symbols: g.symbols ?? [] }));
}

/**
 * The Board's thesis sections, in the bundle's order, then a trailing
 * "No thesis" section with the book's symbols that belong to none, as on the
 * web board. A symbol in two theses shows in both.
 */
export function thesisSections(config: CompanionConfig | null): SymbolSection[] {
  const theses = config?.theses ?? [];
  const inThesis = new Set(theses.flatMap((t) => t.symbols ?? []));
  const sections: SymbolSection[] = theses.map((t) => ({
    title: t.name,
    symbols: t.symbols ?? [],
    accent: t.color,
  }));
  const rest = bookSymbols(config).filter((symbol) => !inThesis.has(symbol));
  if (rest.length > 0) sections.push({ title: 'No thesis', symbols: rest });
  return sections;
}

export type DecodeResult =
  | { ok: true; config: CompanionConfig }
  | { ok: false; reason: 'version'; error: string }
  | { ok: false; reason: 'invalid'; error: string };

/**
 * Validate a raw config payload against Fibenchi's contract.
 *
 * Distinguishes a **version mismatch** (Fibenchi is newer than this app build →
 * the user should update the app) from a genuinely **malformed** payload, so the
 * UI can show the right message.
 */
export function safeDecodeConfig(json: unknown): DecodeResult {
  const version = (json as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version !== SUPPORTED_CONFIG_VERSION) {
    return {
      ok: false,
      reason: 'version',
      error: `Config version ${version} is newer than this app supports (v${SUPPORTED_CONFIG_VERSION}). Update the app.`,
    };
  }
  const result = companionConfigSchema.safeParse(json);
  if (result.success) return { ok: true, config: result.data };
  return { ok: false, reason: 'invalid', error: result.error.message };
}

/** Throwing variant — for when a decode failure is exceptional (e.g. a freshly fetched bundle). */
export function decodeConfig(json: unknown): CompanionConfig {
  return companionConfigSchema.parse(json);
}
