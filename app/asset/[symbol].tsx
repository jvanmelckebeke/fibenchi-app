import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { FlashOnChange } from '@/components/flash-on-change';
import { IntradayChart } from '@/components/intraday-chart';
import { MovementGrid } from '@/components/movement-grid';
import { StatTile } from '@/components/stat-tile';
import { Text } from '@/components/ui/text';
import { buildIndicatorSnapshot, computeMovementStats, indicatorHistoryPeriod } from '@/lib/compute';
import { useConfig } from '@/lib/config/provider';
import { sessionLabel } from '@/lib/date';
import { signedPercent, trendColor } from '@/lib/format';
import { market, type IntradayResult, type OhlcBar, type Period } from '@/lib/market';
import { useTheme, type ThemePalette } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { usePolledQuotes, useQuote } from '@/stores/quotes';

const PERIODS: Period[] = ['1mo', '3mo', '6mo', '1y'];

const numValue = (value: number | string | null | undefined): number | null =>
  typeof value === 'number' ? value : null;

export default function AssetDetail() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const sym = symbol ?? '';
  const theme = useTheme();
  const { config } = useConfig();
  const name = config?.tickers?.[sym]?.name ?? sym;

  usePolledQuotes(sym ? [sym] : []);
  const quote = useQuote(sym);

  const [period, setPeriod] = useState<Period>('6mo');
  const [bars, setBars] = useState<OhlcBar[]>([]);
  const [indicatorBars, setIndicatorBars] = useState<OhlcBar[]>([]);
  const [intraday, setIntraday] = useState<IntradayResult | null>(null);

  // Movement reflects the selected period (the selector sits above the grid).
  useEffect(() => {
    let cancelled = false;
    market.getDaily(sym, period).then((result) => {
      if (!cancelled) setBars(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sym, period]);

  // Indicators are point-in-time (latest RSI/SMA/MACD), so they always fetch
  // enough history to converge — independent of the movement period. Otherwise a
  // short selection (e.g. 1mo) silently drops SMA-50 and skews the EMA-based
  // indicators. When the selected period equals this, the cache de-dups the two.
  useEffect(() => {
    let cancelled = false;
    market.getDaily(sym, indicatorHistoryPeriod()).then((result) => {
      if (!cancelled) setIndicatorBars(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sym]);

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
  const snapshot = useMemo(() => buildIndicatorSnapshot(indicatorBars), [indicatorBars]);

  const changePct = quote?.changePercent ?? null;
  const priceColor = changePct != null ? trendColor(changePct, theme) : theme.flat;

  const intradayPoints = intraday?.points.map((point) => point.price) ?? [];
  const lastIntraday = intradayPoints[intradayPoints.length - 1] ?? 0;
  const intradayColor = trendColor(intraday ? lastIntraday - intraday.previousClose : 0, theme);
  const sessionDay =
    intraday && intraday.points.length > 0
      ? sessionLabel(intraday.points[intraday.points.length - 1].time)
      : 'Today';

  return (
    <>
      <Stack.Screen options={{ title: sym }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        {/* Header */}
        <View>
          <Text className="text-sm text-muted-foreground">{name}</Text>
          <View className="mt-1 flex-row items-end gap-3">
            <FlashOnChange value={quote?.price} radius={6}>
              <Text className="px-1 text-3xl font-bold text-foreground">
                {quote ? quote.price.toFixed(2) : '—'}
              </Text>
            </FlashOnChange>
            {changePct != null && (
              <Text className="pb-1 text-lg" style={{ color: priceColor }}>
                {signedPercent(changePct)}
              </Text>
            )}
          </View>
        </View>

        {/* Today's trajectory */}
        {intraday && intradayPoints.length > 1 && (
          <View>
            <Text className="mb-2 text-xs uppercase text-muted-foreground">{sessionDay}</Text>
            <IntradayChart
              points={intraday.points}
              previousClose={intraday.previousClose}
              color={intradayColor}
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
  theme: ThemePalette;
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
