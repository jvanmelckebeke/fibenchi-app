import { DashPathEffect, Line as SkiaLine, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';

import { Text } from '@/components/ui/text';
import { type RsiPoint } from '@/lib/compute';
import { skiaColor, useTheme } from '@/lib/theme';

interface RsiChartProps {
  /** Converged RSI rows (see `rsiSeries`); needs ≥ 2 to draw. */
  data: RsiPoint[];
}

/**
 * Minimal RSI panel revealed beside a swiped ticker card — the mirror of
 * `MacdChart` on the other edge. A left readout column gives the latest value
 * plus its zone (overbought ≥ 70 in loss red, oversold ≤ 30 in gain green,
 * neutral muted). The chart is the RSI line on the conventional fixed 0–100
 * domain with dashed guides at 30/70, so where the line sits *is* the reading —
 * no axis labels needed at this size.
 */
export function RsiChart({ data }: RsiChartProps) {
  const theme = useTheme();

  const rows = useMemo(() => data.map((point, i) => ({ i, rsi: point.rsi })), [data]);
  const latest = data[data.length - 1] ?? null;

  if (rows.length < 2 || !latest) return <View style={{ flex: 1 }} />;

  const zone =
    latest.rsi >= 70
      ? { label: 'Overbought', color: theme.loss }
      : latest.rsi <= 30
        ? { label: 'Oversold', color: theme.gain }
        : { label: 'Neutral', color: theme.mutedForeground };
  const guideColor = skiaColor(theme.mutedForeground);

  return (
    <View className="flex-1 flex-row items-stretch gap-2">
      <View className="w-[62px] justify-center gap-0.5">
        <Text numberOfLines={1} className="text-[10px] font-medium" style={{ color: theme.chart2 }}>
          RSI {latest.rsi.toFixed(1)}
        </Text>
        <Text numberOfLines={1} className="text-[10px] font-medium" style={{ color: zone.color }}>
          {zone.label}
        </Text>
      </View>
      <View className="flex-1 overflow-hidden">
        <CartesianChart
          data={rows}
          xKey="i"
          yKeys={['rsi']}
          domain={{ y: [0, 100] }}
          domainPadding={{ left: 4, right: 4, top: 4, bottom: 4 }}>
          {({ points, chartBounds, yScale }) => (
            <>
              <Guide
                y={yScale(70)}
                left={chartBounds.left}
                right={chartBounds.right}
                color={guideColor}
              />
              <Guide
                y={yScale(30)}
                left={chartBounds.left}
                right={chartBounds.right}
                color={guideColor}
              />
              <Line points={points.rsi} color={skiaColor(theme.chart2)} strokeWidth={1.5} />
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

function Guide({ y, left, right, color }: { y: number; left: number; right: number; color: string }) {
  return (
    <SkiaLine p1={vec(left, y)} p2={vec(right, y)} color={color} strokeWidth={1}>
      <DashPathEffect intervals={[4, 4]} />
    </SkiaLine>
  );
}
