import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';

import { BoardTile } from '@/components/board/board-tile';
import { OfflineBanner } from '@/components/pulse/offline-banner';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/ui/text';
import { buildBoard, type BoardFilter } from '@/lib/board';
import type { ColorMode } from '@/lib/board-scale';
import { groupSections, thesisSections } from '@/lib/config';
import { useConfig } from '@/lib/config/provider';
import { useBook } from '@/stores/book';

const MODES = [
  { value: 'sigma', label: 'σ-Move' },
  { value: 'pct', label: '% today' },
] as const;

const GROUPINGS = [
  { value: 'group', label: 'Group' },
  { value: 'thesis', label: 'Thesis' },
] as const;

type Grouping = (typeof GROUPINGS)[number]['value'];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
] as const;

const COLUMNS = 4;
const GUTTER = 12;
const GAP = 4;

/**
 * The Board: every asset in the book as a tile coloured by its σ-Move (or
 * today's %), in group sections. The phone's version of the web overview's
 * grid, for the question the Pulse deliberately doesn't answer: "what does the
 * whole book look like?". Four columns, so 88 assets are one short scroll.
 */
export default function Board() {
  const { config, status, sync, needsOnboarding } = useConfig();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<ColorMode>('sigma');
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [grouping, setGrouping] = useState<Grouping>('group');
  // A server that predates theses in the bundle sends none: no toggle then.
  const hasTheses = (config?.theses?.length ?? 0) > 0;
  const byThesis = hasTheses && grouping === 'thesis';
  const { book } = useBook(byThesis ? 'tracked' : 'book');

  const sections = useMemo(
    () => (byThesis ? thesisSections(config) : groupSections(config)),
    [config, byThesis]
  );
  const board = useMemo(
    () => buildBoard(book.assets, sections, mode, filter),
    [book.assets, sections, mode, filter]
  );

  if (needsOnboarding) return <Redirect href="/onboard" />;

  const tileWidth = Math.floor((width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
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
        <View className="flex-row items-center justify-between">
          <Text className="text-[11.5px] text-muted-foreground">
            {open} open ·{' '}
            {pending > 0
              ? `${scored} of ${total} scored, ${pending} loading`
              : `${scored} of ${total} scored`}
          </Text>
          {hasTheses && <Segmented options={GROUPINGS} value={grouping} onChange={setGrouping} />}
        </View>
      </View>

      {board.sections.map((section) => (
        <View key={section.title} className="mt-3 px-3">
          <Text
            className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            style={
              section.accent
                ? { borderLeftWidth: 3, borderLeftColor: section.accent, paddingLeft: 6 }
                : undefined
            }>
            {section.title}{' '}
            <Text className="text-xs text-muted-foreground">{section.tiles.length}</Text>
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {section.tiles.map((tile) => (
              <BoardTile
                key={tile.asset.symbol}
                tile={tile}
                mode={mode}
                span={board.span}
                width={tileWidth}
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
