import { Inter_400Regular } from '@expo-google-fonts/inter';
import { Circle, DashPathEffect, Line as SkiaLine, useFont, vec } from '@shopify/react-native-skia';
import { useColorScheme } from 'nativewind';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAnimatedReaction, useDerivedValue, runOnJS, type SharedValue } from 'react-native-reanimated';
import { CartesianChart, Line, useChartPressState } from 'victory-native';

import { Text } from '@/components/ui/text';
import { type IntradayPoint } from '@/lib/market';
import { skiaColor, THEME } from '@/lib/theme';
import { sessionTime } from '@/lib/date';

interface IntradayChartProps {
  /** Intraday points (time + price) for today. */
  points: IntradayPoint[];
  /** Prior session close — drawn as a dashed baseline. */
  previousClose: number;
  color: string;
  baselineColor: string;
  height?: number;
}

/**
 * Today's intraday trajectory on victory-native: a price line with a dashed
 * previous-close baseline, plus a drag-to-read crosshair (`useChartPressState`).
 * Dragging horizontally shows a vertical guide + marker at the touched point and
 * reads out price/time above; vertical drags fall through so the page still
 * scrolls. Crosshair is drawn in-canvas via shared values (no font dependency).
 */
export function IntradayChart({
  points,
  previousClose,
  color,
  baselineColor,
  height = 180,
}: IntradayChartProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const { state, isActive } = useChartPressState({ x: 0, y: { price: 0 } });
  // Bundled Skia font for the x-axis tick labels (null until loaded — victory
  // just omits labels until then).
  const font = useFont(Inter_400Regular, 10);

  const { data, domain } = useMemo(() => {
    const rows = points.map((point) => ({ t: point.time, price: point.price }));
    const prices = points.map((point) => point.price);
    const lo = Math.min(previousClose, ...prices);
    const hi = Math.max(previousClose, ...prices);
    return { data: rows, domain: [lo, hi] as [number, number] };
  }, [points, previousClose]);

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
        previousClose={previousClose}
        theme={theme}
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
            formatXLabel: (t) => (t ? sessionTime(t) : ''),
          }}
          chartPressState={state}
          // Activate the crosshair on a horizontal drag; let vertical drags fall
          // through to the detail ScrollView.
          chartPressConfig={{ pan: { activeOffsetX: [-10, 10], failOffsetY: [-12, 12] } }}>
          {({ points: cp, chartBounds, yScale }) => (
            <>
              <Baseline
                y={yScale(previousClose)}
                left={chartBounds.left}
                right={chartBounds.right}
                color={baseColor}
              />
              <Line points={cp.price} color={lineColor} strokeWidth={2} />
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
  previousClose,
  theme,
}: {
  isActive: SharedValue<boolean>;
  timeValue: SharedValue<number>;
  priceValue: SharedValue<number>;
  fallback: IntradayPoint;
  previousClose: number;
  theme: (typeof THEME)['dark'];
}) {
  // Re-renders per drag frame, but it's isolated from the chart so the canvas
  // (which animates off shared values) doesn't re-render.
  const [active, setActive] = useState<IntradayPoint | null>(null);
  useAnimatedReaction(
    () => (isActive.value ? { time: timeValue.value, price: priceValue.value } : null),
    (current) => runOnJS(setActive)(current)
  );

  const shown = active ?? fallback;
  const change = shown.price - previousClose;
  const pct = previousClose !== 0 ? (change / previousClose) * 100 : 0;
  const up = change >= 0;

  return (
    <View className="mb-1 flex-row items-baseline gap-2">
      <Text className="text-lg font-semibold text-foreground">{shown.price.toFixed(2)}</Text>
      <Text className="text-xs" style={{ color: up ? theme.gain : theme.loss }}>
        {up ? '+' : ''}
        {change.toFixed(2)} ({up ? '+' : ''}
        {pct.toFixed(2)}%)
      </Text>
      <Text className="text-xs text-muted-foreground">{sessionTime(shown.time)}</Text>
    </View>
  );
}
