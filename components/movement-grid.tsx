import { useColorScheme } from 'nativewind';
import { View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import type { MovementStats } from '@/lib/compute';
import { THEME } from '@/lib/theme';

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export function MovementGrid({ stats }: { stats: MovementStats }) {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const signColor = (n: number) => (n >= 0 ? theme.gain : theme.loss);

  return (
    <View className="flex-row flex-wrap gap-2">
      <StatTile label="Period return" value={pct(stats.periodReturnPct)} color={signColor(stats.periodReturnPct)} />
      {stats.maxDrawdown && <StatTile label="Max drawdown" value={pct(stats.maxDrawdown.pct)} color={theme.loss} />}
      {stats.maxDailyGain && <StatTile label="Best day" value={pct(stats.maxDailyGain.pct)} color={theme.gain} />}
      {stats.maxDailyLoss && <StatTile label="Worst day" value={pct(stats.maxDailyLoss.pct)} color={theme.loss} />}
      <StatTile label="Up / Down days" value={`${stats.upDays} / ${stats.downDays}`} />
    </View>
  );
}
