import { useNavigation } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { TickerCard } from '@/components/ticker-card';
import { useConfig } from '@/lib/config/provider';
import { usePolledQuotes } from '@/stores/quotes';

export default function Overview() {
  const navigation = useNavigation();
  const { config, loading, error, activeGroup, reload } = useConfig();

  const group = useMemo(
    () => config?.groups?.find((candidate) => candidate.name === activeGroup) ?? null,
    [config, activeGroup]
  );
  const symbols = group?.symbols ?? [];
  const tickers = config?.tickers ?? {};

  usePolledQuotes(symbols);

  useEffect(() => {
    navigation.setOptions({ title: activeGroup ?? 'Fibenchi' });
  }, [navigation, activeGroup]);

  if (loading && !config) {
    return (
      <Centered>
        <Text className="text-muted-foreground">Loading…</Text>
      </Centered>
    );
  }

  if (error && !config) {
    return (
      <Centered>
        <Text className="text-center text-loss">{error}</Text>
        <Text className="mt-2 text-center text-xs text-muted-foreground">
          Is the Fibenchi endpoint reachable from this device?
        </Text>
      </Centered>
    );
  }

  return (
    <FlatList
      data={symbols}
      keyExtractor={(symbol) => symbol}
      renderItem={({ item }) => <TickerCard symbol={item} name={tickers[item]?.name ?? item} />}
      contentContainerStyle={{ paddingVertical: 8 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
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
