import { View } from 'react-native';

import { Sparkline } from '@/components/sparkline';
import { Text } from '@/components/ui/text';
import { fetchPortfolioIndex } from '@/lib/config/portfolio-index';
import { useConfig } from '@/lib/config/provider';
import { signedPercent, trendColor } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

/**
 * Fibenchi's equal-weight portfolio index over a year: its value, the year's
 * change, and the line. Unlike everything else on the Pulse it comes from the
 * server, because the index's rules (dynamic entry, quarterly rebalance) live
 * there and a phone copy would be a second version of them. It re-fetches on
 * each config sync (pull to refresh) and is simply absent when the server can't
 * provide it.
 */
export function IndexCard() {
  const theme = useTheme();
  const { endpoint, lastSyncedAt } = useConfig();
  const index = useAsync(() => fetchPortfolioIndex(endpoint), [endpoint, lastSyncedAt]);

  if (!index || index.current === null || index.values.length < 2) return null;
  const color = trendColor(index.changePct, theme);

  return (
    <View className="mx-3 mt-4 flex-row items-center justify-between rounded-xl border border-border bg-card px-3 py-3">
      <View>
        <Text className="text-sm font-semibold text-foreground">Portfolio index</Text>
        <Text className="mt-0.5 text-xl font-semibold text-foreground">
          {index.current.toFixed(2)}
        </Text>
        {index.changePct !== null && (
          <Text className="text-xs" style={{ color }}>
            {signedPercent(index.changePct)} · {index.period}
          </Text>
        )}
      </View>
      <Sparkline data={index.values} color={color} width={150} height={48} />
    </View>
  );
}
