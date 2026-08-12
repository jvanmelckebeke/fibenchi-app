import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { sessionTime } from '@/lib/date';

interface OfflineBannerProps {
  /** Age of the newest quote in the book, ms. */
  offlineFor: number;
  since: number | null;
  /** Seconds until the next poll attempt, if known. */
  retryIn: number | null;
}

/**
 * The app's dominant failure mode, and the one with no desktop equivalent: the
 * backend loses a symbol or two, the phone loses **all 44 at once**, on a train.
 * So this is a screen-level state, and it says which of two facts it is
 * reporting — the market is still trading, our numbers are not.
 *
 * Nothing is hidden and nothing is recomputed. The screen keeps showing the last
 * good state and is explicit about its age.
 */
export function OfflineBanner({ offlineFor, since, retryIn }: OfflineBannerProps) {
  const mins = Math.max(1, Math.round(offlineFor / 60_000));
  return (
    <View className="mx-3 mb-1 gap-0.5 rounded-xl border border-border bg-card px-3 py-2">
      <Text className="text-sm font-semibold text-market-post">
        Offline{since !== null ? ` since ${sessionTime(since / 1000)}` : ''} · {mins} min
      </Text>
      <Text className="text-xs text-muted-foreground">
        Markets may still be trading. These numbers are not.
      </Text>
      {retryIn !== null && (
        <Text className="text-xs text-muted-foreground">Retrying in {retryIn}s</Text>
      )}
    </View>
  );
}
