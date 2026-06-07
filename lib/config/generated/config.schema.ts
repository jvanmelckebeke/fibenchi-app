// GENERATED from schema/companion.schema.json by `npm run gen:config` — do not edit by hand.
import { z } from 'zod';

export const companionConfigSchema = z
  .object({
    version: z
      .literal(1)
      .describe(
        "Contract version the app gates on (always sent; required so the app's gate can't be bypassed by an absent field)"
      ),
    generatedAt: z
      .string()
      .datetime({ offset: true })
      .describe('When this bundle was produced (UTC)'),
    groups: z
      .array(
        z
          .object({
            name: z.string().describe('Group name'),
            icon: z.union([z.string(), z.null()]).describe('Lucide icon name').default(null),
            isDefault: z
              .boolean()
              .describe('Whether this is the protected default group (Watchlist)'),
            position: z.number().int().describe('Display order (0 = first)'),
            symbols: z
              .array(z.string())
              .describe('Ticker symbols in this group, in order')
              .optional(),
          })
          .describe('A user group as ordered symbol references.')
      )
      .describe('User groups, ordered')
      .optional(),
    tickers: z
      .record(
        z.string(),
        z
          .object({
            name: z.string().describe('Display name'),
            type: z.enum(['stock', 'etf', 'index']),
            currency: z
              .string()
              .describe('ISO 4217 display code (normalized, e.g. GBp -> GBP)')
              .default('USD'),
            tags: z.array(z.string()).describe('Tag names attached to this symbol').optional(),
          })
          .describe('Metadata for a single tracked symbol (defined once across all groups).')
      )
      .describe('symbol -> metadata')
      .optional(),
    tags: z.record(z.string(), z.string()).describe('tag name -> hex colour').optional(),
  })
  .describe('The full config bundle the companion app pulls and caches.');
