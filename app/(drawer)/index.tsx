import { Redirect, useNavigation, useRouter } from 'expo-router';
import { Search as SearchIcon } from 'lucide-react-native';
import { useCallback, useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { BreadthHeader } from '@/components/pulse/breadth-header';
import { MoversCard } from '@/components/pulse/movers-card';
import { OfflineBanner } from '@/components/pulse/offline-banner';
import { SigmaRow } from '@/components/pulse/sigma-row';
import { TailStrip } from '@/components/pulse/tail-strip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SIGMA_MOVE_WARMUP } from '@/lib/compute';
import { useConfig } from '@/lib/config/provider';
import { useBook } from '@/stores/book';

/**
 * The Pulse — the home screen.
 *
 * The one question the phone should answer is "do I need to open the laptop?".
 * The group list answers "what does everything look like", which is a different
 * question, and the Board's (one tap on the tail strip). So the top of this
 * screen is the five most extreme σ-moves across the whole book under a
 * breadth headline: no threshold, no grouping. Below the fold sits the slow
 * view, Movers over a week to a month, which costs no fetches of its own.
 *
 * The layout *is* the request policy (spec principle 6): five rows pull a minute
 * series for their sparkline, the other ~39 assets are one coloured bar each in
 * the tail strip, and only open venues poll at all.
 */
export default function Pulse() {
  const navigation = useNavigation();
  const router = useRouter();
  const { config, status, error, sync, needsOnboarding } = useConfig();

  const HeaderSearch = useCallback(
    () => (
      <Pressable onPress={() => router.push('/search')} hitSlop={12} className="px-4">
        <Icon as={SearchIcon} size={20} className="text-foreground" />
      </Pressable>
    ),
    [router]
  );

  useEffect(() => {
    navigation.setOptions({ title: 'Pulse', headerRight: HeaderSearch });
  }, [navigation, HeaderSearch]);

  const { symbols, book, daily, now } = useBook();

  if (needsOnboarding) return <Redirect href="/onboard" />;

  if (!config) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        {error ? (
          <>
            <Text className="text-center text-loss">{error}</Text>
            <Text className="mt-2 text-center text-xs text-muted-foreground">
              Is the Fibenchi endpoint reachable from this device?
            </Text>
          </>
        ) : (
          <Text className="text-muted-foreground">Loading…</Text>
        )}
      </View>
    );
  }

  const fresh = book.offlineFor === null;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 16 }}
      refreshControl={<RefreshControl refreshing={status === 'syncing'} onRefresh={sync} />}>
      {book.offlineFor !== null && (
        <OfflineBanner offlineFor={book.offlineFor} since={book.lastGoodAt} retryIn={null} />
      )}

      <BreadthHeader book={book} now={now} />

      {book.top.map((asset) => (
        <SigmaRow key={asset.symbol} asset={asset} fresh={fresh} />
      ))}

      {/* Not an empty state for a quiet day — a quiet day still ranks five, they
          are just all pale. This is only the cold-start window, before enough
          daily history has arrived for anything to be scored. */}
      {book.top.length === 0 && (
        <Text className="px-4 py-6 text-sm text-muted-foreground">
          {symbols.length === 0
            ? 'No symbols tracked yet.'
            : `Scoring ${symbols.length} symbols — σ-Move needs ${SIGMA_MOVE_WARMUP} sessions of history each.`}
        </Text>
      )}

      <TailStrip assets={book.tail} dim={!fresh} onPress={() => router.navigate('/board')} />

      <MoversCard assets={book.assets} daily={daily} now={now} />
    </ScrollView>
  );
}
