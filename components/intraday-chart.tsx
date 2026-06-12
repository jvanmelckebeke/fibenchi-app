import { useMemo } from 'react';

import { PriceLineChart, type PriceLineSegment } from '@/components/price-line-chart';
import { sessionTime } from '@/lib/date';
import { type PriceFormat } from '@/lib/format';
import { type IntradayPoint, type SessionWindow } from '@/lib/market';
import { useTheme } from '@/lib/theme';

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
  /**
   * Regular-session window for the day the points belong to. When set, the line
   * is split into session segments: pre-market blue, regular `color`, after-hours
   * orange (matching Fibenchi's market-status colours).
   */
  regularWindow?: SessionWindow | null;
  /** Overrides the readout change colour (e.g. session blue for a pre-market move). */
  changeColor?: string;
}

/**
 * Split the trajectory at the regular-session boundaries. Guarded against a
 * stale window (Yahoo's `currentTradingPeriod` can already describe the *next*
 * session when viewing, say, Friday's bars on a weekend) — if the window starts
 * more than a day after the last print, the sessions don't line up, so fall back
 * to a single-colour line rather than mislabel the whole day as pre-market.
 */
function sessionSegments(
  points: IntradayPoint[],
  window: SessionWindow | null | undefined,
  colors: { pre: string; regular: string; post: string }
): PriceLineSegment[] | undefined {
  if (!window || points.length === 0) return undefined;
  const lastTime = points[points.length - 1].time;
  if (window.start - lastTime > 86_400) return undefined;

  const firstRegular = points.findIndex((p) => p.time >= window.start);
  const firstPost = points.findIndex((p) => p.time >= window.end);
  const segments: PriceLineSegment[] = [];
  if (firstRegular !== 0) segments.push({ from: 0, color: colors.pre });
  if (firstRegular !== -1 && firstRegular !== firstPost) {
    segments.push({ from: firstRegular, color: colors.regular });
  }
  if (firstPost !== -1) segments.push({ from: firstPost, color: colors.post });
  // All-regular needs no segmentation — let the plain line render.
  return segments.length === 1 && segments[0].color === colors.regular ? undefined : segments;
}

/**
 * Today's intraday trajectory — a thin wrapper over `PriceLineChart` with the
 * previous close as the baseline, clock-time x labels, and session-coloured
 * pre/post extended-hours segments. (`IntradayPoint` is already
 * `{ time, price }`, so it feeds the chart directly.)
 */
export function IntradayChart({
  points,
  previousClose,
  color,
  baselineColor,
  format,
  height,
  regularWindow,
  changeColor,
}: IntradayChartProps) {
  const theme = useTheme();
  const segments = useMemo(
    () =>
      sessionSegments(points, regularWindow, {
        pre: theme.marketPre,
        regular: color,
        post: theme.marketPost,
      }),
    [points, regularWindow, theme, color]
  );

  return (
    <PriceLineChart
      points={points}
      baseline={previousClose}
      color={color}
      baselineColor={baselineColor}
      xFormat={sessionTime}
      format={format}
      height={height}
      segments={segments}
      changeColor={changeColor}
    />
  );
}
