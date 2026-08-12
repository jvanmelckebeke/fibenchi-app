import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { sessionTime } from '@/lib/date';
import type { PulseBook } from '@/lib/pulse';
import { useTheme } from '@/lib/theme';

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

interface BreadthHeaderProps {
  book: PulseBook;
  now: number;
}

/**
 * The header. **Breadth is the hero** — up count versus down count over the live
 * set — because it is the only candidate that changes how you read the five rows
 * below it: +3.1σ means one thing when the tape is 13-up-9-down and something
 * else when it's fighting a red market.
 *
 * It is also the reason the row count is fixed at five: with the count constant,
 * the headline is free to report something that actually varies. A hero that
 * restated row one (`Widest +3.1σ`) would be wasted screen.
 */
export function BreadthHeader({ book, now }: BreadthHeaderProps) {
  const theme = useTheme();
  const [showCoverage, setShowCoverage] = useState(false);
  const { breadth, scored, total, offlineFor, lastGoodAt } = book;
  const offline = offlineFor !== null;

  return (
    <View className="gap-1.5 px-4 pb-3 pt-2">
      <Text className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {offline && lastGoodAt !== null
          ? `AS OF ${sessionTime(lastGoodAt / 1000)} · ${minutes(offlineFor!)} OLD`
          : `${WEEKDAYS[new Date(now).getDay()]} ${sessionTime(now / 1000)}`}
      </Text>

      <Text className="text-[27px] font-semibold leading-tight tracking-tight text-foreground">
        {breadth.up} up · {breadth.down} down
      </Text>

      <BreadthBar up={breadth.up} down={breadth.down} dim={offline} />

      <Text className="text-[11.5px] text-muted-foreground">
        {offline
          ? '0 live'
          : breadth.live === 0
            ? 'nothing trading right now'
            : `of ${breadth.live} trading right now`}
      </Text>

      <Pressable onPress={() => setShowCoverage((open) => !open)} hitSlop={8}>
        <Text
          className="self-start text-[11.5px] text-muted-foreground"
          style={{
            textDecorationLine: 'underline',
            textDecorationStyle: 'dashed',
            textDecorationColor: theme.mutedForeground,
          }}>
          {scored} of {total} scored {showCoverage ? '▴' : '▾'}
        </Text>
      </Pressable>

      {/* The count *is* the disclosure — an earlier draft gave these three
          assets full cards, ~20% of the viewport, for things that are usually
          not actionable. Closed, this costs nothing. */}
      {showCoverage && (
        <View className="mt-1 gap-1 rounded-lg border border-border px-3 py-2">
          {book.unscored.length === 0 ? (
            <Text className="text-xs text-muted-foreground">Every symbol has a reading.</Text>
          ) : (
            book.unscored.map((asset) => (
              <View key={asset.symbol} className="flex-row justify-between gap-3">
                <Text className="text-xs font-medium text-foreground">{asset.symbol}</Text>
                <Text numberOfLines={1} className="flex-1 text-right text-xs text-muted-foreground">
                  {asset.unscored}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Redundant with the numbers on purpose: the numbers are the accessible
 * encoding, the bar is the glanceable one.
 */
function BreadthBar({ up, down, dim }: { up: number; down: number; dim: boolean }) {
  const theme = useTheme();
  const total = up + down;
  if (total === 0) {
    return <View className="h-[3px] rounded-full bg-muted" style={{ opacity: dim ? 0.5 : 1 }} />;
  }
  return (
    <View className="h-[3px] flex-row gap-[2px]" style={{ opacity: dim ? 0.5 : 1 }}>
      <View style={{ flex: up, backgroundColor: theme.gain, borderRadius: 2 }} />
      <View style={{ flex: down, backgroundColor: theme.loss, borderRadius: 2 }} />
    </View>
  );
}

function minutes(ms: number): string {
  const mins = Math.round(ms / 60_000);
  return mins < 1 ? '<1 MIN' : `${mins} MIN`;
}
