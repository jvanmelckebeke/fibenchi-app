import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Segmented } from '@/components/segmented';
import { Text } from '@/components/ui/text';
import { signedPercent } from '@/lib/format';
import type { OhlcBar } from '@/lib/market';
import { MOVER_WINDOWS, rankMovers, type Mover, type MoverWindow } from '@/lib/movers';
import type { PulseAsset } from '@/lib/pulse';
import { useTheme } from '@/lib/theme';

interface MoversCardProps {
  assets: PulseAsset[];
  daily: Record<string, OhlcBar[] | undefined>;
  now: number;
}

/**
 * Top five up and down by % over a week, two weeks or a month: the slow
 * counterpart to the σ rows above, which only ever speak about today. Up and
 * down sit side by side so the card is five rows tall, not ten. It reads the
 * daily bars the σ already fetched, so it costs no requests of its own.
 */
export function MoversCard({ assets, daily, now }: MoversCardProps) {
  const theme = useTheme();
  const [window, setWindow] = useState<MoverWindow>('1wk');

  const movers = useMemo(
    () =>
      rankMovers(
        assets.map((a) => ({
          symbol: a.symbol,
          bars: daily[a.symbol],
          price: a.quote?.price ?? null,
        })),
        window,
        now
      ),
    [assets, daily, window, now]
  );

  return (
    <View className="mx-3 mt-4 rounded-xl border border-border bg-card px-3 py-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">Movers</Text>
        <Segmented options={MOVER_WINDOWS} value={window} onChange={setWindow} />
      </View>
      <View className="flex-row gap-4">
        <MoverColumn movers={movers.up} color={theme.gain} empty="nothing up" />
        <MoverColumn movers={movers.down} color={theme.loss} empty="nothing down" />
      </View>
      {movers.missing > 0 && (
        <Text className="mt-2 text-[11px] text-muted-foreground">
          {movers.missing} without a {window} series yet
        </Text>
      )}
    </View>
  );
}

function MoverColumn({ movers, color, empty }: { movers: Mover[]; color: string; empty: string }) {
  const router = useRouter();
  if (movers.length === 0) {
    return <Text className="flex-1 text-xs text-muted-foreground">{empty}</Text>;
  }
  return (
    <View className="flex-1 gap-0.5">
      {movers.map((m) => (
        <Pressable
          key={m.symbol}
          onPress={() => router.push({ pathname: '/asset/[symbol]', params: { symbol: m.symbol } })}
          className="flex-row items-center justify-between py-1">
          <Text numberOfLines={1} className="mr-2 flex-1 text-sm font-medium text-foreground">
            {m.symbol}
          </Text>
          <Text className="text-sm" style={{ color }}>
            {signedPercent(m.pct, 1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
