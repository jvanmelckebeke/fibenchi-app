// Public surface of the market-data layer. Explicit exports (no `export *`) so
// what's exposed is curated.
import { PriceProvider, YahooProvider } from './provider';

export type {
  Period,
  MarketState,
  Quote,
  OhlcBar,
  IntradayPoint,
  IntradayResult,
  SessionWindow,
  SymbolSearchResult,
} from './types';
export { PriceProvider, YahooProvider };
/** Request/failure counters over the client's rolling window — see Settings. */
export { requestStats } from './yahoo/client';
export type { RequestStats } from './yahoo/client';

/** Default app-wide market-data provider. */
export const market: PriceProvider = new YahooProvider();
