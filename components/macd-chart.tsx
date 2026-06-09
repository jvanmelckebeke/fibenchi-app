import { useColorScheme } from 'nativewind';
import { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart, Bar, Line } from 'victory-native';

import { Text } from '@/components/ui/text';
import { type MacdPoint } from '@/lib/compute';
import { skiaColor, THEME } from '@/lib/theme';

interface MacdChartProps {
  /** Converged MACD rows (see `macdSeries`); needs ≥ 2 to draw. */
  data: MacdPoint[];
  /** Optional tag shown above the readout (e.g. the symbol). */
  label?: string;
}

/** Compact value formatting — MACD magnitude scales with price, so adapt precision. */
function fmt(value: number): string {
  const abs = Math.abs(value);
  const decimals = abs >= 10 ? 1 : 2;
  return value.toFixed(decimals);
}

/**
 * Minimal 1-month MACD panel revealed behind a swiped ticker card. A left
 * readout column names each series by colour and gives its latest value (blue
 * MACD, orange signal, green/red histogram) — that doubles as the legend and
 * keeps the chart itself narrow rather than full-bleed. The chart is a bicolour
 * histogram (green above zero / red below) under the MACD and signal lines;
 * histogram is two `Bar` series (positive-only / negative-only, zero-height
 * off-sign bars) since victory's `Bar` anchors at `yScale(0)`. Y-domain is
 * symmetric about 0 so the zero baseline sits mid-panel.
 */
export function MacdChart({ data, label }: MacdChartProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];

  const { rows, bound, latest } = useMemo(() => {
    const mapped = data.map((point, i) => ({
      i,
      macd: point.macd,
      signal: point.signal,
      histUp: point.hist > 0 ? point.hist : 0,
      histDown: point.hist < 0 ? point.hist : 0,
    }));
    const maxAbs = data.reduce(
      (max, p) => Math.max(max, Math.abs(p.macd), Math.abs(p.signal), Math.abs(p.hist)),
      0
    );
    return { rows: mapped, bound: maxAbs || 1, latest: data[data.length - 1] ?? null };
  }, [data]);

  if (rows.length < 2 || !latest) return <View style={{ flex: 1 }} />;

  const histColor = latest.hist >= 0 ? theme.gain : theme.loss;

  return (
    <View className="flex-1 flex-row items-stretch">
      <View className="w-24 justify-center gap-0.5 pl-1">
        {label && <Text className="text-xs font-semibold text-foreground">{label}</Text>}
        <Readout color={theme.chart1} name="MACD" value={fmt(latest.macd)} />
        <Readout color={theme.chart3} name="Signal" value={fmt(latest.signal)} />
        <Readout color={histColor} name="Hist" value={fmt(latest.hist)} square />
      </View>
      <View className="flex-1">
        <CartesianChart
          data={rows}
          xKey="i"
          yKeys={['histUp', 'histDown', 'macd', 'signal']}
          domain={{ y: [-bound, bound] }}
          domainPadding={{ top: 4, bottom: 4 }}>
          {({ points, chartBounds }) => (
            <>
              <Bar points={points.histUp} chartBounds={chartBounds} color={skiaColor(theme.gain)} innerPadding={0.3} />
              <Bar points={points.histDown} chartBounds={chartBounds} color={skiaColor(theme.loss)} innerPadding={0.3} />
              <Line points={points.macd} color={skiaColor(theme.chart1)} strokeWidth={1.5} />
              <Line points={points.signal} color={skiaColor(theme.chart3)} strokeWidth={1.5} />
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

function Readout({
  color,
  name,
  value,
  square,
}: {
  color: string;
  name: string;
  value: string;
  square?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 9, height: square ? 9 : 2, borderRadius: 1, backgroundColor: color }} />
      <Text className="text-[10px] text-muted-foreground">{name}</Text>
      <Text className="text-[10px] font-semibold" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}
