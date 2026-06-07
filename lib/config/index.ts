import { z } from 'zod';

import { companionConfigSchema } from './generated/config.schema';

/**
 * Config-contract version this app build understands. Must match Fibenchi's
 * `CONFIG_VERSION`. The generated schema also pins it via `z.literal(...)`.
 */
export const SUPPORTED_CONFIG_VERSION = 1 as const;

/** Decoded, validated config bundle — type inferred from the generated Zod schema (SoT). */
export type CompanionConfig = z.infer<typeof companionConfigSchema>;

export type DecodeResult =
  | { ok: true; config: CompanionConfig }
  | { ok: false; reason: 'version'; error: string }
  | { ok: false; reason: 'invalid'; error: string };

/**
 * Validate a raw config payload against the generated contract.
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
