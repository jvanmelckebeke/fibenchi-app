import { Stack, useRouter } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useConfig } from '@/lib/config/provider';
import { type SymbolSearchResult } from '@/lib/market';
import { useSymbolSearch } from '@/lib/search';
import { THEME } from '@/lib/theme';

type Row =
  | { key: string; kind: 'header'; title: string; trailing?: boolean }
  | { key: string; kind: 'result'; result: SymbolSearchResult }
  | { key: string; kind: 'note'; text: string };

/**
 * Symbol lookup. Local watchlist matches render instantly; Yahoo matches stream
 * in below (debounced, deduped) so you can pull up any ticker — e.g. `RR.L` —
 * even one you don't track. Tapping a row opens its detail page.
 */
export default function SearchScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const { config } = useConfig();

  const [query, setQuery] = useState('');
  const { local, yahoo, loading } = useSymbolSearch(query, config);
  const trimmed = query.trim();

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (local.length > 0) {
      out.push({ key: 'h-local', kind: 'header', title: 'Watchlist' });
      for (const r of local) out.push({ key: `l-${r.symbol}`, kind: 'result', result: r });
    }
    if (yahoo.length > 0) {
      out.push({ key: 'h-yahoo', kind: 'header', title: 'Yahoo Finance', trailing: loading });
      for (const r of yahoo) out.push({ key: `y-${r.symbol}`, kind: 'result', result: r });
    }
    if (trimmed.length > 0 && local.length === 0 && yahoo.length === 0) {
      out.push({ key: 'note', kind: 'note', text: loading ? 'Searching…' : `No matches for “${trimmed}”` });
    }
    return out;
  }, [local, yahoo, loading, trimmed]);

  return (
    <>
      <Stack.Screen options={{ title: 'Search' }} />
      <View className="flex-1 bg-background">
        <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
          <View className="flex-1 flex-row items-center">
            <View className="absolute left-3 z-10">
              <Icon as={SearchIcon} size={16} className="text-muted-foreground" />
            </View>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search symbol or name (e.g. RR.L)"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="flex-1 pl-9 pr-9"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} className="absolute right-3 z-10">
                <Icon as={X} size={16} className="text-muted-foreground" />
              </Pressable>
            )}
          </View>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View className="flex-row items-center gap-2 px-4 pb-1 pt-4">
                  <Text className="text-xs uppercase text-muted-foreground">{item.title}</Text>
                  {item.trailing && <ActivityIndicator size="small" color={theme.mutedForeground} />}
                </View>
              );
            }
            if (item.kind === 'note') {
              return <Text className="px-4 py-6 text-center text-sm text-muted-foreground">{item.text}</Text>;
            }
            return (
              <ResultRow
                result={item.result}
                onPress={() =>
                  router.push({ pathname: '/asset/[symbol]', params: { symbol: item.result.symbol } })
                }
              />
            );
          }}
        />
      </View>
    </>
  );
}

function ResultRow({ result, onPress }: { result: SymbolSearchResult; onPress: () => void }) {
  const badge = result.tracked
    ? 'Tracked'
    : [result.exchange, result.type !== 'other' ? result.type.toUpperCase() : null].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ borderless: false }}
      className="flex-row items-center justify-between gap-3 px-4 py-3 active:bg-accent/50">
      <View className="flex-1">
        <Text className="font-semibold text-foreground">{result.symbol}</Text>
        <Text numberOfLines={1} className="text-sm text-muted-foreground">
          {result.name}
        </Text>
      </View>
      {badge.length > 0 && (
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {badge}
        </Text>
      )}
    </Pressable>
  );
}
