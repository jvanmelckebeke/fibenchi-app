import { View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import type { IntradayStats } from '@/lib/compute';
import { formatPrice, sessionBadge, signedPercent, trendColor, type PriceFormat } from '@/lib/format';
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
  // *is* the pre-market move — badge label + session blue, like the chart.
  // During/after the regular session it stays the green/red day return vs the
  // previous close, with the post move as its own badge-coloured tile.
  const badge = sessionBadge(session, theme);
  const preBadge = session === 'pre' ? badge : null;

  return (
    <View className="flex-row flex-wrap gap-2">
      <StatTile
        label={preBadge?.label ?? 'Day return'}
        value={signedPercent(stats.dayReturnPct)}
        color={preBadge?.color ?? trendColor(stats.dayReturnPct, theme)}
      />
      {session === 'post' && badge && afterHoursPct != null && (
        <StatTile label={badge.label} value={signedPercent(afterHoursPct)} color={badge.color} />
      )}
      <StatTile label="Intraday high" value={formatPrice(stats.high, format)} />
      <StatTile label="Intraday low" value={formatPrice(stats.low, format)} />
      {stats.drawdownPct < 0 && (
        <StatTile label="Drawdown" value={signedPercent(stats.drawdownPct)} color={theme.loss} />
      )}
    </View>
  );
}
