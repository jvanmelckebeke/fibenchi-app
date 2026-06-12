import { Inter_400Regular } from '@expo-google-fonts/inter';
import { Circle, DashPathEffect, Line as SkiaLine, useFont, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAnimatedReaction, useDerivedValue, runOnJS, type SharedValue } from 'react-native-reanimated';
import { CartesianChart, Line, useChartPressState } from 'victory-native';

import { Text } from '@/components/ui/text';
import { formatPrice, signed, signedPercent, trendColor, type PriceFormat } from '@/lib/format';
import { skiaColor, useTheme, type ThemePalette } from '@/lib/theme';

/** A single (time, price) sample — daily close or intraday print. */
export interface PriceLinePoint {
  /** Epoch seconds. */
  time: number;
  price: number;
}

/**
 * A contiguous run of points drawn in its own colour — how the intraday line
 * distinguishes pre/regular/post sessions. `from` indexes into `points`; a
 * segment runs to the next segment's `from` (the last one to the end).
 */
export interface PriceLineSegment {
  from: number;
  color: string;
}

interface PriceLineChartProps {
  /** Ascending (time, price) samples; needs ≥ 2 to draw. */
  points: PriceLinePoint[];
  /**
   * Reference price drawn as a dashed baseline and used as the change baseline
   * in the readout — previous close for intraday, the period's first close for a
   * daily range.
   */
  baseline: number;
  color: string;
  baselineColor: string;
  /** Formats an x value (epoch seconds) for the axis ticks and the readout. */
  xFormat: (epochSeconds: number) => string;
  /** Formatting hints for the readout price (symbol + currency). */
  format: PriceFormat;
  height?: number;
  /**
   * Session-coloured runs (ascending `from`, covering the whole series). When
   * given, they replace the single `color` line; `color` still drives the
   * crosshair dot.
   */
  segments?: PriceLineSegment[];
  /** Overrides the readout change colour (e.g. session blue for a pre-market move). */
  changeColor?: string;
}

/**
 * Shared price line on victory-native: a price line with a dashed baseline plus
 * a drag-to-read crosshair (`useChartPressState`). Dragging horizontally shows a
 * vertical guide + marker at the touched point and reads out price/change/time
 * above; vertical drags fall through so the page still scrolls. Crosshair is
 * drawn in-canvas via shared values (no font dependency).
 *
 * Backs both `IntradayChart` (intraday prints, baseline = previous close,
 * x = clock time) and `DailyChart` (daily closes, baseline = first close,
 * x = calendar date) — the only differences are the data mapping, the baseline,
 * and the x formatter, all passed in.
 */
export function PriceLineChart({
  points,
  baseline,
  color,
  baselineColor,
  xFormat,
  format,
  height = 180,
  segments,
  changeColor,
}: PriceLineChartProps) {
  const theme = useTheme();
  const { state, isActive } = useChartPressState({ x: 0, y: { price: 0 } });
  // Bundled Skia font for the x-axis tick labels (null until loaded — victory
  // just omits labels until then).
  const font = useFont(Inter_400Regular, 10);

  const { data, domain } = useMemo(() => {
    const rows = points.map((point) => ({ t: point.time, price: point.price }));
    const prices = points.map((point) => point.price);
    const lo = Math.min(baseline, ...prices);
    const hi = Math.max(baseline, ...prices);
    return { data: rows, domain: [lo, hi] as [number, number] };
  }, [points, baseline]);

  if (data.length < 2) return <View style={{ height }} />;

  const lineColor = skiaColor(color);
  const guideColor = skiaColor(theme.mutedForeground);
  const baseColor = skiaColor(baselineColor);

  return (
    <View>
      <Readout
        isActive={state.isActive}
        timeValue={state.x.value}
        priceValue={state.y.price.value}
        fallback={points[points.length - 1]}
        baseline={baseline}
        xFormat={xFormat}
        format={format}
        theme={theme}
        changeColor={changeColor}
      />
      <View style={{ height }}>
        <CartesianChart
          data={data}
          xKey="t"
          yKeys={['price']}
          domain={{ y: domain }}
          domainPadding={{ top: 8, bottom: 8 }}
          xAxis={{
            font,
            tickCount: 4,
            lineWidth: 0,
            labelColor: skiaColor(theme.mutedForeground),
            formatXLabel: (t) => (t ? xFormat(t) : ''),
          }}
          chartPressState={state}
          // Activate the crosshair on a horizontal drag; let vertical drags fall
          // through to the detail ScrollView.
          chartPressConfig={{ pan: { activeOffsetX: [-10, 10], failOffsetY: [-12, 12] } }}>
          {({ points: cp, chartBounds, yScale }) => (
            <>
              <Baseline
                y={yScale(baseline)}
                left={chartBounds.left}
                right={chartBounds.right}
                color={baseColor}
              />
              {segments && segments.length > 0 ? (
                // One <Line> per session run, sharing the boundary point so the
                // path stays visually continuous across colour changes.
                segments.map((segment, i) => (
                  <Line
                    key={`${segment.from}-${i}`}
                    points={cp.price.slice(segment.from, (segments[i + 1]?.from ?? cp.price.length - 1) + 1)}
                    color={skiaColor(segment.color)}
                    strokeWidth={2}
                  />
                ))
              ) : (
                <Line points={cp.price} color={lineColor} strokeWidth={2} />
              )}
              {isActive && (
                <Crosshair
                  x={state.x.position}
                  y={state.y.price.position}
                  top={chartBounds.top}
                  bottom={chartBounds.bottom}
                  color={guideColor}
                  dotColor={lineColor}
                />
              )}
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

function Baseline({ y, left, right, color }: { y: number; left: number; right: number; color: string }) {
  return (
    <SkiaLine p1={vec(left, y)} p2={vec(right, y)} color={color} strokeWidth={1}>
      <DashPathEffect intervals={[4, 4]} />
    </SkiaLine>
  );
}

function Crosshair({
  x,
  y,
  top,
  bottom,
  color,
  dotColor,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  top: number;
  bottom: number;
  color: string;
  dotColor: string;
}) {
  const p1 = useDerivedValue(() => vec(x.value, top));
  const p2 = useDerivedValue(() => vec(x.value, bottom));
  return (
    <>
      <SkiaLine p1={p1} p2={p2} color={color} strokeWidth={1}>
        <DashPathEffect intervals={[3, 3]} />
      </SkiaLine>
      <Circle cx={x} cy={y} r={4} color={dotColor} />
    </>
  );
}

function Readout({
  isActive,
  timeValue,
  priceValue,
  fallback,
  baseline,
  xFormat,
  format,
  theme,
  changeColor,
}: {
  isActive: SharedValue<boolean>;
  timeValue: SharedValue<number>;
  priceValue: SharedValue<number>;
  fallback: PriceLinePoint;
  baseline: number;
  xFormat: (epochSeconds: number) => string;
  format: PriceFormat;
  theme: ThemePalette;
  changeColor?: string;
}) {
  // Re-renders per drag frame, but it's isolated from the chart so the canvas
  // (which animates off shared values) doesn't re-render.
  const [active, setActive] = useState<PriceLinePoint | null>(null);
  useAnimatedReaction(
    () => (isActive.value ? { time: timeValue.value, price: priceValue.value } : null),
    (current) => runOnJS(setActive)(current)
  );

  const shown = active ?? fallback;
  const change = shown.price - baseline;
  const pct = baseline !== 0 ? (change / baseline) * 100 : 0;

  return (
    <View className="mb-1 flex-row items-baseline gap-2">
      <Text className="text-lg font-semibold text-foreground">
        {formatPrice(shown.price, format)}
      </Text>
      <Text className="text-xs" style={{ color: changeColor ?? trendColor(change, theme) }}>
        {signed(change)} ({signedPercent(pct)})
      </Text>
      <Text className="text-xs text-muted-foreground">{xFormat(shown.time)}</Text>
    </View>
  );
}
