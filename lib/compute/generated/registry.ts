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
    fieldDecimals: {
      rsi_delta: 1,
      rsi_delta_sigma: 1,
    },
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
    fieldDecimals: {
      macd_hist_delta: 2,
      macd_hist_delta_sigma: 1,
      macd_delta: 2,
      macd_delta_sigma: 1,
    },
    warmup: 35,
    snapshotDerived: 'macd',
  },
  {
    key: 'vnr',
    kernel: 'volatility_normalized_return',
    params: {
      lam: 0.94,
    },
    outputFields: ['vnr'],
    decimals: 2,
    fieldDecimals: {
      vnr_sigma: 6,
      vnr_gap_sessions: 0,
    },
    warmup: 60,
    snapshotDerived: null,
  },
];
