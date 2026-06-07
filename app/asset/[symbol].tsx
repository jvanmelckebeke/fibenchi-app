import { Stack, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { IntradayChart } from '@/components/intraday-chart';
import { MovementGrid } from '@/components/movement-grid';
import { StatTile } from '@/components/stat-tile';
import { Text } from '@/components/ui/text';
import { buildIndicatorSnapshot, computeMovementStats } from '@/lib/compute';
import { useConfig } from '@/lib/config/provider';
import { market, type IntradayResult, type OhlcBar, type Period } from '@/lib/market';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { usePolledQuotes, useQuote } from '@/stores/quotes';

const PERIODS: Period[] = ['1mo', '3mo', '6mo', '1y'];

const numValue = (value: number | string | null | undefined): number | null =>
  typeof value === 'number' ? value : null;

export default function AssetDetail() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const sym = symbol ?? '';
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const { config } = useConfig();
  const name = config?.tickers?.[sym]?.name ?? sym;

  usePolledQuotes(sym ? [sym] : []);
  const quote = useQuote(sym);

  const [period, setPeriod] = useState<Period>('6mo');
  const [bars, setBars] = useState<OhlcBar[]>([]);
  const [intraday, setIntraday] = useState<IntradayResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    market.getDaily(sym, period).then((result) => {
      if (!cancelled) setBars(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sym, period]);

  useEffect(() => {
    let cancelled = false;
    market.getIntraday(sym).then((result) => {
      if (!cancelled) setIntraday(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sym]);

  const movement = useMemo(() => computeMovementStats(bars), [bars]);
  const snapshot = useMemo(() => buildIndicatorSnapshot(bars), [bars]);

  const changePct = quote?.changePercent ?? null;
  const up = (changePct ?? 0) >= 0;
  const trendColor = up ? theme.gain : theme.loss;

  const intradayPoints = intraday?.points.map((point) => point.price) ?? [];
  const lastIntraday = intradayPoints[intradayPoints.length - 1] ?? 0;
  const intradayUp = intraday ? lastIntraday >= intraday.previousClose : true;

  return (
    <>
      <Stack.Screen options={{ title: sym }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        {/* Header */}
        <View>
          <Text className="text-sm text-muted-foreground">{name}</Text>
          <View className="mt-1 flex-row items-end gap-3">
            <Text className="text-3xl font-bold text-foreground">{quote ? quote.price.toFixed(2) : '—'}</Text>
            {changePct != null && (
              <Text className="pb-1 text-lg" style={{ color: trendColor }}>
                {up ? '+' : ''}
                {changePct.toFixed(2)}%
              </Text>
            )}
          </View>
        </View>

        {/* Today's trajectory */}
        {intraday && intradayPoints.length > 1 && (
          <View>
            <Text className="mb-2 text-xs uppercase text-muted-foreground">Today</Text>
            <IntradayChart
              points={intradayPoints}
              previousClose={intraday.previousClose}
              color={intradayUp ? theme.gain : theme.loss}
              baselineColor={theme.mutedForeground}
            />
          </View>
        )}

        {/* Movement + period selector */}
        <View>
          <View className="mb-2 flex-row gap-2">
            {PERIODS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setPeriod(option)}
                className={cn('rounded-md px-3 py-1', option === period && 'bg-accent')}>
                <Text className={cn('text-xs', option === period ? 'text-foreground' : 'text-muted-foreground')}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
          {movement ? (
            <MovementGrid stats={movement} />
          ) : (
            <Text className="text-sm text-muted-foreground">Loading movement…</Text>
          )}
        </View>

        {/* Indicators */}
        {snapshot && <Indicators snapshot={snapshot} theme={theme} />}
      </ScrollView>
    </>
  );
}

function Indicators({
  snapshot,
  theme,
}: {
  snapshot: NonNullable<ReturnType<typeof buildIndicatorSnapshot>>;
  theme: (typeof THEME)['dark'];
}) {
  const values = snapshot.values;
  const rsi = numValue(values.rsi);
  const sma20 = numValue(values.sma_20);
  const sma50 = numValue(values.sma_50);
  const macdDir = typeof values.macd_signal_dir === 'string' ? values.macd_signal_dir : null;
  const close = snapshot.close;

  const rsiColor = rsi == null ? undefined : rsi > 70 ? theme.loss : rsi < 30 ? theme.gain : undefined;

  return (
    <View>
      <Text className="mb-2 text-xs uppercase text-muted-foreground">Indicators</Text>
      <View className="flex-row flex-wrap gap-2">
        {rsi != null && <StatTile label="RSI (14)" value={rsi.toFixed(1)} color={rsiColor} />}
        {macdDir && (
          <StatTile
            label="MACD"
            value={macdDir === 'bullish' ? '▲ bullish' : '▼ bearish'}
            color={macdDir === 'bullish' ? theme.gain : theme.loss}
          />
        )}
        {sma20 != null && (
          <StatTile label="SMA 20" value={sma20.toFixed(2)} color={close >= sma20 ? theme.gain : theme.loss} />
        )}
        {sma50 != null && (
          <StatTile label="SMA 50" value={sma50.toFixed(2)} color={close >= sma50 ? theme.gain : theme.loss} />
        )}
      </View>
    </View>
  );
}
