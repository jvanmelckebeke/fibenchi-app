/** Daily-history ranges supported for indicator/movement computation. */
export type Period = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y';

/** Trading session the market is currently in (derived from the trading-period windows). */
export type MarketState = 'pre' | 'regular' | 'post' | 'closed';

/** A point-in-time quote for a single symbol. */
export interface Quote {
  symbol: string;
  price: number;
  /** Prior session close — the baseline for day change. */
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string | null;
  shortName: string | null;
  marketState: MarketState;
  /** Epoch seconds of the last regular-market print. */
  marketTime: number;
}

/** A single OHLC(V) bar (daily or intraday). */
export interface OhlcBar {
  /** Epoch seconds at the bar's open. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number | null;
  volume: number | null;
}

/** A reduced intraday point — just close, for sparklines / the day's trajectory. */
export interface IntradayPoint {
  time: number;
  price: number;
}

/** Today's intraday trajectory for a symbol. */
export interface IntradayResult {
  symbol: string;
  previousClose: number;
  points: IntradayPoint[];
}
