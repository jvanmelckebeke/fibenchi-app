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
}

/** Compact value formatting — MACD magnitude scales with price, so adapt precision. */
function fmt(value: number): string {
  const abs = Math.abs(value);
  const decimals = abs >= 10 ? 1 : 2;
  return value.toFixed(decimals);
}

/**
 * Minimal MACD panel revealed beside a swiped ticker card. A left readout
 * column gives each series' latest value as a colour-coded text line (blue MACD,
 * orange signal, green/red histogram) — that is the legend, no marker glyphs.
 * The chart is a bicolour histogram (green above zero / red below) under the
 * MACD and signal lines; histogram is two `Bar` series (positive-only /
 * negative-only, zero-height off-sign bars) since victory's `Bar` anchors at
 * `yScale(0)`. Y-domain is symmetric about 0 so the zero baseline sits mid-panel.
 * The caller passes a short tail of converged rows (calc still spans full
 * history — see `macdSeries`) so a handful of days don't crowd the narrow chart.
 */
export function MacdChart({ data }: MacdChartProps) {
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
    <View className="flex-1 flex-row items-stretch gap-2">
      <View className="w-[62px] justify-center gap-0.5">
        <Readout color={theme.chart1} name="MACD" value={fmt(latest.macd)} />
        <Readout color={theme.chart3} name="Signal" value={fmt(latest.signal)} />
        <Readout color={histColor} name="Hist" value={fmt(latest.hist)} />
      </View>
      <View className="flex-1 overflow-hidden">
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

function Readout({ color, name, value }: { color: string; name: string; value: string }) {
  // The colour is the legend — no marker glyph.
  return (
    <Text numberOfLines={1} className="text-[10px] font-medium" style={{ color }}>
      {name} {value}
    </Text>
  );
}
