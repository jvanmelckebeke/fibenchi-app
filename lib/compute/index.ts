// Public surface of the on-device compute layer.
export { computeMovementStats, computeIntradayStats } from './movement';
export type { MovementStats, IntradayStats } from './movement';
export {
  SIGMA_MOVE_WARMUP,
  buildIndicatorSnapshot,
  computeIndicators,
  getMaxWarmup,
  indicatorHistoryPeriod,
  macdSeries,
  primeSigmaSeries,
  rsiSeries,
  rsiZone,
  sigmaMove,
} from './indicators';
export type {
  IndicatorSnapshot,
  ComputedIndicators,
  MacdPoint,
  RsiPoint,
  RsiZone,
  SigmaMove,
  SigmaPoint,
} from './indicators';
