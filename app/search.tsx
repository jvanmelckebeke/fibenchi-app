import { Stack, useRouter } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useConfig } from '@/lib/config/provider';
import { type SymbolSearchResult } from '@/lib/market';
import { useSymbolSearch } from '@/lib/search';

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
        <View className="px-4 pb-2 pt-3">
          <View className="h-11 flex-row items-center gap-2 rounded-lg border border-input bg-background px-3">
            <Icon as={SearchIcon} size={18} className="text-muted-foreground" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search symbol or name (e.g. RR.L)"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="h-full flex-1 p-0 text-base leading-5 text-foreground placeholder:text-muted-foreground/60"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Icon as={X} size={18} className="text-muted-foreground" />
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
                  {item.trailing && <ActivityIndicator size="small" />}
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
