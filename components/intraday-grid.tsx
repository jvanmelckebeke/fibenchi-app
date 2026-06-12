import { View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import type { IntradayStats } from '@/lib/compute';
import { formatPrice, signedPercent, trendColor, type PriceFormat } from '@/lib/format';
import type { MarketState } from '@/lib/market';
import { useTheme } from '@/lib/theme';

interface IntradayGridProps {
  stats: IntradayStats;
  format: PriceFormat;
  /** Current session — recolours/relabels the return tile outside regular hours. */
  session?: MarketState | null;
  /** After-hours move vs today's regular close, shown as an extra tile during `post`. */
  afterHoursPct?: number | null;
}

/** The 1d counterpart to `MovementGrid` — intraday-appropriate stats. */
export function IntradayGrid({ stats, format, session, afterHoursPct }: IntradayGridProps) {
  const theme = useTheme();
  // During pre-market the whole trajectory is extended-hours, so the return tile
  // *is* the pre-market move — session blue, like the chart. During/after the
  // regular session it stays the green/red day return vs the previous close.
  const isPre = session === 'pre';

  return (
    <View className="flex-row flex-wrap gap-2">
      <StatTile
        label={isPre ? 'Pre-market' : 'Day return'}
        value={signedPercent(stats.dayReturnPct)}
        color={isPre ? theme.marketPre : trendColor(stats.dayReturnPct, theme)}
      />
      {session === 'post' && afterHoursPct != null && (
        <StatTile
          label="After-hours"
          value={signedPercent(afterHoursPct)}
          color={theme.marketPost}
        />
      )}
      <StatTile label="Intraday high" value={formatPrice(stats.high, format)} />
      <StatTile label="Intraday low" value={formatPrice(stats.low, format)} />
      {stats.drawdownPct < 0 && (
        <StatTile label="Drawdown" value={signedPercent(stats.drawdownPct)} color={theme.loss} />
      )}
    </View>
  );
}
