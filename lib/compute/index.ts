// Public surface of the on-device compute layer.
export { computeMovementStats } from './movement';
export type { MovementStats } from './movement';
export {
  buildIndicatorSnapshot,
  computeIndicators,
  getMaxWarmup,
  macdSeries,
} from './indicators';
export type { IndicatorSnapshot, ComputedIndicators, MacdPoint } from './indicators';
