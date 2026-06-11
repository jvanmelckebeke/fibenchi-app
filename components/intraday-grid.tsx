import { View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import type { IntradayStats } from '@/lib/compute';
import { signedPercent, trendColor } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/** The 1d counterpart to `MovementGrid` — intraday-appropriate stats. */
export function IntradayGrid({ stats }: { stats: IntradayStats }) {
  const theme = useTheme();

  return (
    <View className="flex-row flex-wrap gap-2">
      <StatTile
        label="Day return"
        value={signedPercent(stats.dayReturnPct)}
        color={trendColor(stats.dayReturnPct, theme)}
      />
      <StatTile label="Intraday high" value={stats.high.toFixed(2)} />
      <StatTile label="Intraday low" value={stats.low.toFixed(2)} />
      {stats.drawdownPct < 0 && (
        <StatTile label="Drawdown" value={signedPercent(stats.drawdownPct)} color={theme.loss} />
      )}
    </View>
  );
}
