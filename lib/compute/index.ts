// Public surface of the on-device compute layer.
export { computeMovementStats, computeIntradayStats } from './movement';
export type { MovementStats, IntradayStats } from './movement';
export {
  buildIndicatorSnapshot,
  computeIndicators,
  getMaxWarmup,
  indicatorHistoryPeriod,
  macdSeries,
} from './indicators';
export type { IndicatorSnapshot, ComputedIndicators, MacdPoint } from './indicators';
