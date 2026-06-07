// Public surface of the on-device compute layer.
export { computeMovementStats } from './movement';
export type { MovementStats } from './movement';
export {
  buildIndicatorSnapshot,
  computeIndicators,
  getMaxWarmup,
} from './indicators';
export type { IndicatorSnapshot, ComputedIndicators } from './indicators';
