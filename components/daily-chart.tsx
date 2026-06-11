import { useMemo } from 'react';

import { PriceLineChart } from '@/components/price-line-chart';
import { chartDate } from '@/lib/date';
import { type PriceFormat } from '@/lib/format';
import { type OhlcBar } from '@/lib/market';

interface DailyChartProps {
  /** Daily OHLC bars over the selected period (ascending by time). */
  bars: OhlcBar[];
  color: string;
  baselineColor: string;
  /** Formatting hints for the readout price. */
  format: PriceFormat;
  height?: number;
}

/**
 * Daily-close line over a selected period — a thin wrapper over `PriceLineChart`.
 * The baseline is the period's first close (so the line above/below it mirrors
 * the "period return"), and x labels are calendar dates.
 */
export function DailyChart({ bars, color, baselineColor, format, height }: DailyChartProps) {
  const points = useMemo(() => bars.map((bar) => ({ time: bar.time, price: bar.close })), [bars]);
  const baseline = bars[0]?.close ?? 0;

  return (
    <PriceLineChart
      points={points}
      baseline={baseline}
      color={color}
      baselineColor={baselineColor}
      xFormat={chartDate}
      format={format}
      height={height}
    />
  );
}
