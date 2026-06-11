// GENERATED from schema/indicator.contract.json by `npm run gen:indicators` — do not edit by hand.
// Source of truth: fibenchi/backend/scripts/export_indicator_contract.py

export interface IndicatorSpec {
  key: string;
  kernel: string;
  params: Record<string, number>;
  outputFields: string[];
  decimals: number;
  fieldDecimals: Record<string, number>;
  warmup: number;
  snapshotDerived: string | null;
}

export const INDICATOR_SPECS: IndicatorSpec[] = [
  {
    key: 'rsi',
    kernel: 'rsi',
    params: {
      period: 14,
    },
    outputFields: ['rsi'],
    decimals: 2,
    fieldDecimals: {},
    warmup: 14,
    snapshotDerived: null,
  },
  {
    key: 'sma_20',
    kernel: 'sma',
    params: {
      period: 20,
    },
    outputFields: ['sma_20'],
    decimals: 4,
    fieldDecimals: {},
    warmup: 20,
    snapshotDerived: null,
  },
  {
    key: 'sma_50',
    kernel: 'sma',
    params: {
      period: 50,
    },
    outputFields: ['sma_50'],
    decimals: 4,
    fieldDecimals: {},
    warmup: 50,
    snapshotDerived: null,
  },
  {
    key: 'macd',
    kernel: 'macd',
    params: {
      fast: 12,
      slow: 26,
      signal: 9,
    },
    outputFields: ['macd', 'macd_signal', 'macd_hist'],
    decimals: 4,
    fieldDecimals: {},
    warmup: 35,
    snapshotDerived: 'macd',
  },
];
