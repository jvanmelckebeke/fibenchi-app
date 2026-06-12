import { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart, Bar, Line } from 'victory-native';

import { Readout, ReadoutColumn } from '@/components/chart-readout';
import { type MacdPoint } from '@/lib/compute';
import { skiaColor, useTheme } from '@/lib/theme';

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
  const theme = useTheme();

  const { rows, bound, latest } = useMemo(() => {
    const mapped = data.map((point, i) => ({
      i,
      macd: point.macd,
      signal: point.macd_signal,
      histUp: point.macd_hist > 0 ? point.macd_hist : 0,
      histDown: point.macd_hist < 0 ? point.macd_hist : 0,
    }));
    const maxAbs = data.reduce(
      (max, p) => Math.max(max, Math.abs(p.macd), Math.abs(p.macd_signal), Math.abs(p.macd_hist)),
      0
    );
    return { rows: mapped, bound: maxAbs || 1, latest: data[data.length - 1] ?? null };
  }, [data]);

  if (rows.length < 2 || !latest) return <View style={{ flex: 1 }} />;

  const histColor = latest.macd_hist >= 0 ? theme.gain : theme.loss;

  return (
    <View className="flex-1 flex-row items-stretch gap-2">
      <ReadoutColumn>
        <Readout color={theme.chart1} label={`MACD ${fmt(latest.macd)}`} />
        <Readout color={theme.chart3} label={`Signal ${fmt(latest.macd_signal)}`} />
        <Readout color={histColor} label={`Hist ${fmt(latest.macd_hist)}`} />
      </ReadoutColumn>
      <View className="flex-1 overflow-hidden">
        <CartesianChart
          data={rows}
          xKey="i"
          yKeys={['histUp', 'histDown', 'macd', 'signal']}
          domain={{ y: [-bound, bound] }}
          // left/right keep the first & last bars fully inside the plot (else
          // they're centred on the edge and clipped to half-bars).
          domainPadding={{ left: 16, right: 16, top: 4, bottom: 4 }}>
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
