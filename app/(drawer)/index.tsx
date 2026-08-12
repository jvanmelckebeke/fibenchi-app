import { Redirect, useNavigation, useRouter } from 'expo-router';
import { Search as SearchIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { BreadthHeader } from '@/components/pulse/breadth-header';
import { OfflineBanner } from '@/components/pulse/offline-banner';
import { SigmaRow } from '@/components/pulse/sigma-row';
import { TailStrip } from '@/components/pulse/tail-strip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SIGMA_MOVE_WARMUP } from '@/lib/compute';
import { orderedGroups } from '@/lib/config';
import { useConfig } from '@/lib/config/provider';
import { buildPulseBook } from '@/lib/pulse';
import { useDailyBook } from '@/stores/daily';
import { GLANCE_CADENCE_MS, usePolledQuotes, useQuoteBook } from '@/stores/quotes';

/**
 * The Pulse — the home screen.
 *
 * The one question the phone should answer is "do I need to open the laptop?".
 * The group list answers "what does everything look like", which is a different
 * question and a laptop's job. So this screen is the five most extreme σ-moves
 * across the whole book under a breadth headline, and nothing else: no
 * threshold, no grouping, no scrolling. The group screen it replaces is still
 * there, one drawer entry away.
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

  // The whole book, deduped across groups — a symbol in three groups is one
  // symbol here, and σ-Move is a property of the asset, not of the group.
  const symbols = useMemo(() => {
    const seen = new Set<string>();
    for (const group of orderedGroups(config)) {
      for (const symbol of group.symbols ?? []) seen.add(symbol);
    }
    return [...seen];
  }, [config]);

  usePolledQuotes(symbols, 'glance');
  const quotes = useQuoteBook(symbols);
  const daily = useDailyBook(symbols);

  // A clock tick, so the eyebrow's time and the staleness age advance without a
  // quote having to land — being offline is exactly the case where none will.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const book = useMemo(
    () => buildPulseBook({ symbols, quotes, daily, cadenceMs: GLANCE_CADENCE_MS, now }),
    [symbols, quotes, daily, now]
  );

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

      <TailStrip assets={book.tail} dim={!fresh} onPress={() => router.navigate('/group')} />
    </ScrollView>
  );
}
