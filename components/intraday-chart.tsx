import { PriceLineChart } from '@/components/price-line-chart';
import { sessionTime } from '@/lib/date';
import { type PriceFormat } from '@/lib/format';
import { type IntradayPoint } from '@/lib/market';

interface IntradayChartProps {
  /** Intraday points (time + price) for today. */
  points: IntradayPoint[];
  /** Prior session close — drawn as a dashed baseline. */
  previousClose: number;
  color: string;
  baselineColor: string;
  /** Formatting hints for the readout price. */
  format: PriceFormat;
  height?: number;
}

/**
 * Today's intraday trajectory — a thin wrapper over `PriceLineChart` with the
 * previous close as the baseline and clock-time x labels. (`IntradayPoint` is
 * already `{ time, price }`, so it feeds the chart directly.)
 */
export function IntradayChart({
  points,
  previousClose,
  color,
  baselineColor,
  format,
  height,
}: IntradayChartProps) {
  return (
    <PriceLineChart
      points={points}
      baseline={previousClose}
      color={color}
      baselineColor={baselineColor}
      xFormat={sessionTime}
      format={format}
      height={height}
    />
  );
}
