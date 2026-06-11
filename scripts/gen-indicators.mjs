// Generate the app's indicator registry from Fibenchi's indicator contract
// (single source of truth — see fibenchi/backend/scripts/export_indicator_contract.py).
//
// Only indicators tagged for the "app" platform are emitted. The numeric kernels
// stay hand-written in lib/compute/series-math.ts and are dispatched by `kernel`
// id in indicators.ts; the golden fixtures (same exporter) pin that math to the
// pandas reference. This file only carries the declarative metadata, so adding /
// promoting an indicator upstream can't silently drift from the app.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const INPUT = 'schema/indicator.contract.json';
const OUTPUT = 'lib/compute/generated/registry.ts';

const contract = JSON.parse(readFileSync(INPUT, 'utf8'));
const appIndicators = contract.indicators.filter((i) => i.platforms.includes('app'));

const specs = appIndicators.map((i) => ({
  key: i.key,
  kernel: i.kernel,
  params: i.params,
  outputFields: i.outputFields,
  decimals: i.decimals,
  // Keep only field-decimal overrides that apply to a kernel output field
  // (the contract's overrides target web-only *_delta analysis fields).
  fieldDecimals: Object.fromEntries(
    Object.entries(i.fieldDecimals ?? {}).filter(([f]) => i.outputFields.includes(f))
  ),
  warmup: i.warmup,
  snapshotDerived: i.snapshotDerived,
}));

const header =
  `// GENERATED from ${INPUT} by \`npm run gen:indicators\` — do not edit by hand.\n` +
  `// Source of truth: fibenchi/backend/scripts/export_indicator_contract.py\n\n`;

const body =
  `export interface IndicatorSpec {\n` +
  `  key: string;\n` +
  `  kernel: string;\n` +
  `  params: Record<string, number>;\n` +
  `  outputFields: string[];\n` +
  `  decimals: number;\n` +
  `  fieldDecimals: Record<string, number>;\n` +
  `  warmup: number;\n` +
  `  snapshotDerived: string | null;\n` +
  `}\n\n` +
  `export const INDICATOR_SPECS: IndicatorSpec[] = ${JSON.stringify(specs, null, 2)};\n`;

mkdirSync('lib/compute/generated', { recursive: true });
writeFileSync(OUTPUT, header + body);
console.log(`wrote ${OUTPUT} (${specs.length} app indicators)`);
