import { View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import type { MovementStats } from '@/lib/compute';
import { signedPercent, trendColor } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export function MovementGrid({ stats }: { stats: MovementStats }) {
  const theme = useTheme();

  return (
    <View className="flex-row flex-wrap gap-2">
      <StatTile
        label="Period return"
        value={signedPercent(stats.periodReturnPct)}
        color={trendColor(stats.periodReturnPct, theme)}
      />
      {stats.maxDrawdown && <StatTile label="Max drawdown" value={signedPercent(stats.maxDrawdown.pct)} color={theme.loss} />}
      {stats.maxDailyGain && <StatTile label="Best day" value={signedPercent(stats.maxDailyGain.pct)} color={theme.gain} />}
      {stats.maxDailyLoss && <StatTile label="Worst day" value={signedPercent(stats.maxDailyLoss.pct)} color={theme.loss} />}
      <StatTile label="Up / Down days" value={`${stats.upDays} / ${stats.downDays}`} />
    </View>
  );
}
