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
  /** Resolved ISO 4217 display code (major unit, e.g. `GBP`). Always set — see `resolveCurrency`. */
  currency: string;
  shortName: string | null;
  marketState: MarketState;
  /**
   * Whether this symbol is tradeable *right now*, on its own exchange's clock —
   * the per-symbol signal that drives live polling. True during the regular
   * session (Yahoo's `currentTradingPeriod` already localises this per exchange,
   * so `.MI`/`.L` follow EU hours), and always true for crypto (24/7). Pre/post
   * count as closed for cadence purposes.
   */
  isOpen: boolean;
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

/** An exchange session window in epoch seconds (from `currentTradingPeriod`). */
export interface SessionWindow {
  start: number;
  end: number;
}

/** Today's intraday trajectory for a symbol. */
export interface IntradayResult {
  symbol: string;
  previousClose: number;
  points: IntradayPoint[];
  /**
   * The regular-session window of the day the points belong to, or null when
   * Yahoo omits it — lets the UI split the trajectory into pre/regular/post
   * segments instead of guessing sessions from clock time.
   */
  regularWindow: SessionWindow | null;
}

/** A symbol-search hit (from the local watchlist or Yahoo's search endpoint). */
export interface SymbolSearchResult {
  symbol: string;
  /** Company / fund name, or the symbol itself when no name is known. */
  name: string;
  /** Short exchange label (e.g. "LSE", "NMS"), or null when unknown. */
  exchange: string | null;
  type: 'stock' | 'etf' | 'index' | 'other';
  /** True when the symbol is already in the synced Fibenchi watchlist. */
  tracked: boolean;
}
