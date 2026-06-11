import { View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import type { IntradayStats } from '@/lib/compute';
import { formatPriceMaybe, signedPercent, trendColor } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/** The 1d counterpart to `MovementGrid` — intraday-appropriate stats. */
export function IntradayGrid({ stats, currency }: { stats: IntradayStats; currency?: string }) {
  const theme = useTheme();

  return (
    <View className="flex-row flex-wrap gap-2">
      <StatTile
        label="Day return"
        value={signedPercent(stats.dayReturnPct)}
        color={trendColor(stats.dayReturnPct, theme)}
      />
      <StatTile label="Intraday high" value={formatPriceMaybe(stats.high, currency)} />
      <StatTile label="Intraday low" value={formatPriceMaybe(stats.low, currency)} />
      {stats.drawdownPct < 0 && (
        <StatTile label="Drawdown" value={signedPercent(stats.drawdownPct)} color={theme.loss} />
      )}
    </View>
  );
}
