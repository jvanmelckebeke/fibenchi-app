import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { BoardRow } from '@/components/board/board-row';
import { OfflineBanner } from '@/components/pulse/offline-banner';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/ui/text';
import { buildBoard, type BoardFilter } from '@/lib/board';
import type { ColorMode } from '@/lib/board-scale';
import { orderedGroups } from '@/lib/config';
import { useConfig } from '@/lib/config/provider';
import { useBook } from '@/stores/book';

const MODES = [
  { value: 'sigma', label: 'σ-Move' },
  { value: 'pct', label: '% today' },
] as const;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
] as const;

const GAP = 4;

/**
 * The Board: every asset in the book as a tile coloured by its σ-Move (or
 * today's %), in group sections, one card per row with the 1wk/2wk/1mo moves
 * beside it. The phone's version of the web overview's grid, for the question
 * the Pulse deliberately doesn't answer: "what does the whole book look like?".
 */
export default function Board() {
  const { config, status, sync, needsOnboarding } = useConfig();
  const { book, daily, now } = useBook();
  const [mode, setMode] = useState<ColorMode>('sigma');
  const [filter, setFilter] = useState<BoardFilter>('all');

  const sections = useMemo(
    () => orderedGroups(config).map((g) => ({ title: g.name, symbols: g.symbols ?? [] })),
    [config]
  );
  const board = useMemo(
    () => buildBoard(book.assets, sections, mode, filter, daily, now),
    [book.assets, sections, mode, filter, daily, now]
  );

  if (needsOnboarding) return <Redirect href="/onboard" />;

  const fresh = book.offlineFor === null;
  const { open, scored, pending, total } = board.coverage;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 16 }}
      refreshControl={<RefreshControl refreshing={status === 'syncing'} onRefresh={sync} />}>
      {!fresh && (
        <OfflineBanner offlineFor={book.offlineFor!} since={book.lastGoodAt} retryIn={null} />
      )}

      <View className="gap-2 px-3 pb-1 pt-3">
        <View className="flex-row items-center justify-between">
          <Segmented options={MODES} value={mode} onChange={setMode} />
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        </View>
        <Text className="text-[11.5px] text-muted-foreground">
          {open} open ·{' '}
          {pending > 0
            ? `${scored} of ${total} scored, ${pending} loading`
            : `${scored} of ${total} scored`}
        </Text>
      </View>

      {board.sections.map((section) => (
        <View key={section.title} className="mt-3 px-3">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}{' '}
            <Text className="text-xs text-muted-foreground">{section.tiles.length}</Text>
          </Text>
          <View style={{ gap: GAP }}>
            {section.tiles.map((tile) => (
              <BoardRow
                key={tile.asset.symbol}
                tile={tile}
                mode={mode}
                span={board.span}
                fresh={fresh}
              />
            ))}
          </View>
        </View>
      ))}

      {board.sections.length === 0 && (
        <Text className="px-4 py-6 text-sm text-muted-foreground">
          {filter === 'open'
            ? 'Nothing is in a regular session right now.'
            : 'No symbols tracked yet.'}
        </Text>
      )}
    </ScrollView>
  );
}
