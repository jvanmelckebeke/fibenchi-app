import { useColorScheme } from 'nativewind';
import { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart, Bar, Line } from 'victory-native';

import { type MacdPoint } from '@/lib/compute';
import { skiaColor, THEME } from '@/lib/theme';

interface MacdChartProps {
  /** Converged MACD rows (see `macdSeries`); needs ≥ 2 to draw. */
  data: MacdPoint[];
}

/**
 * Minimal, axis-less 1-month MACD panel revealed behind a swiped ticker card:
 * a bicolour histogram (green above zero / red below) under the MACD and signal
 * lines. The histogram is two `Bar` series — positive-only and negative-only,
 * with zero (invisible) bars for the off-sign — because victory's `Bar` anchors
 * at `yScale(0)`, so each side grows from the zero baseline. The y-domain is
 * symmetric about 0 so that baseline sits mid-panel and crossovers read.
 */
export function MacdChart({ data }: MacdChartProps) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];

  const { rows, bound } = useMemo(() => {
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
    return { rows: mapped, bound: maxAbs || 1 };
  }, [data]);

  if (rows.length < 2) return <View style={{ flex: 1 }} />;

  const up = skiaColor(theme.gain);
  const down = skiaColor(theme.loss);
  const macdColor = skiaColor(theme.chart1);
  const signalColor = skiaColor(theme.chart3);

  return (
    <View style={{ flex: 1 }}>
      <CartesianChart
        data={rows}
        xKey="i"
        yKeys={['histUp', 'histDown', 'macd', 'signal']}
        domain={{ y: [-bound * 1.1, bound * 1.1] }}>
        {({ points, chartBounds }) => (
          <>
            <Bar points={points.histUp} chartBounds={chartBounds} color={up} innerPadding={0.3} />
            <Bar points={points.histDown} chartBounds={chartBounds} color={down} innerPadding={0.3} />
            <Line points={points.macd} color={macdColor} strokeWidth={1.5} />
            <Line points={points.signal} color={signalColor} strokeWidth={1.5} />
          </>
        )}
      </CartesianChart>
    </View>
  );
}
