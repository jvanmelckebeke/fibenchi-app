import { Redirect, useNavigation, useRouter } from 'expo-router';
import { Search as SearchIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TickerCard } from '@/components/ticker-card';
import { useConfig } from '@/lib/config/provider';
import { usePolledQuotes } from '@/stores/quotes';

export default function Overview() {
  const navigation = useNavigation();
  const router = useRouter();
  const { config, status, error, activeGroup, sync, needsOnboarding } = useConfig();

  const HeaderSearch = useCallback(
    () => (
      <Pressable onPress={() => router.push('/search')} hitSlop={12} className="px-4">
        <Icon as={SearchIcon} size={20} className="text-foreground" />
      </Pressable>
    ),
    [router]
  );

  const group = useMemo(
    () => config?.groups?.find((candidate) => candidate.name === activeGroup) ?? null,
    [config, activeGroup]
  );
  const symbols = group?.symbols ?? [];
  const tickers = config?.tickers ?? {};

  usePolledQuotes(symbols);

  useEffect(() => {
    navigation.setOptions({ title: activeGroup ?? 'Fibenchi', headerRight: HeaderSearch });
  }, [navigation, activeGroup, HeaderSearch]);

  if (needsOnboarding) return <Redirect href="/onboard" />;

  if (!config) {
    return (
      <Centered>
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
      </Centered>
    );
  }

  return (
    <FlatList
      data={symbols}
      keyExtractor={(symbol) => symbol}
      renderItem={({ item }) => <TickerCard symbol={item} name={tickers[item]?.name ?? item} />}
      contentContainerStyle={{ paddingVertical: 8 }}
      refreshControl={<RefreshControl refreshing={status === 'syncing'} onRefresh={sync} />}
      ListEmptyComponent={
        <Centered>
          <Text className="text-muted-foreground">No symbols in this group.</Text>
        </Centered>
      }
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center p-6">{children}</View>;
}
