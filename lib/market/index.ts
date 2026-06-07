// Public surface of the market-data layer. Explicit exports (no `export *`) so
// what's exposed is curated.
import { PriceProvider, YahooProvider } from './provider';

export type { Period, MarketState, Quote, OhlcBar, IntradayPoint, IntradayResult } from './types';
export { PriceProvider, YahooProvider };

/** Default app-wide market-data provider. */
export const market: PriceProvider = new YahooProvider();
