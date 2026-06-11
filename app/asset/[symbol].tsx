import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { DailyChart } from '@/components/daily-chart';
import { FlashOnChange } from '@/components/flash-on-change';
import { IntradayChart } from '@/components/intraday-chart';
import { IntradayGrid } from '@/components/intraday-grid';
import { MovementGrid } from '@/components/movement-grid';
import { StatTile } from '@/components/stat-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  buildIndicatorSnapshot,
  computeIntradayStats,
  computeMovementStats,
  indicatorHistoryPeriod,
} from '@/lib/compute';
import { useConfig } from '@/lib/config/provider';
import { sessionLabel } from '@/lib/date';
import { signedPercent, trendColor } from '@/lib/format';
import { market, type IntradayResult, type OhlcBar, type Period } from '@/lib/market';
import { useTheme, type ThemePalette } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { usePolledQuotes, useQuote } from '@/stores/quotes';

// `1d` is the intraday view; the rest are daily-history `Period`s. The selector
// spans both, so it has its own union rather than reusing `Period`.
const TIMEFRAMES = ['1d', '1mo', '3mo', '6mo', '1y'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
// The non-1d timeframes are a subset of `Period` — narrow to that subset so it's
// assignable to `getDaily` / `PERIOD_LABEL` without a cast.
type DailyTimeframe = Exclude<Timeframe, '1d'>;
const isDailyPeriod = (tf: Timeframe): tf is DailyTimeframe => tf !== '1d';

const PERIOD_LABEL: Record<Period, string> = {
  '1mo': '1 month',
  '3mo': '3 months',
  '6mo': '6 months',
  '1y': '1 year',
  '2y': '2 years',
  '5y': '5 years',
};

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

  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [bars, setBars] = useState<OhlcBar[]>([]);
  // Which period `bars` currently holds — lets the view tell "data for the
  // selected period" apart from stale bars left over from the prior selection,
  // so a daily→daily switch shows a skeleton instead of the old chart.
  const [barsPeriod, setBarsPeriod] = useState<Period | null>(null);
  const [indicatorBars, setIndicatorBars] = useState<OhlcBar[]>([]);
  const [intraday, setIntraday] = useState<IntradayResult | null>(null);

  // Daily bars back both the daily chart and its movement grid; only fetched
  // when a daily timeframe is selected (1d runs entirely off the intraday data).
  useEffect(() => {
    if (!isDailyPeriod(timeframe)) return;
    let cancelled = false;
    market.getDaily(sym, timeframe).then((result) => {
      if (!cancelled) {
        setBars(result);
        setBarsPeriod(timeframe);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sym, timeframe]);

  // Indicators are point-in-time (latest RSI/SMA/MACD), so they always fetch
  // enough history to converge — independent of the selected timeframe. Otherwise
  // a short selection (e.g. 1mo) silently drops SMA-50 and skews the EMA-based
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

  // Intraday is always fetched — it backs both the 1d chart/stats and lets the
  // user switch back to 1d without a refetch round-trip.
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
  const intradayStats = useMemo(() => (intraday ? computeIntradayStats(intraday) : null), [intraday]);
  const snapshot = useMemo(() => buildIndicatorSnapshot(indicatorBars), [indicatorBars]);

  const changePct = quote?.changePercent ?? null;
  const priceColor = changePct != null ? trendColor(changePct, theme) : theme.flat;

  const intradayPoints = intraday?.points ?? [];
  const lastIntraday = intradayPoints[intradayPoints.length - 1]?.price ?? 0;
  const intradayColor = trendColor(intraday ? lastIntraday - intraday.previousClose : 0, theme);
  const sessionDay =
    intraday && intraday.points.length > 0
      ? sessionLabel(intraday.points[intraday.points.length - 1].time)
      : 'Today';

  const showIntraday = timeframe === '1d';
  const chartLabel = showIntraday ? sessionDay : PERIOD_LABEL[timeframe];
  const dailyColor = movement ? trendColor(movement.periodReturnPct, theme) : theme.flat;
  // For 1d the (cached) intraday is the readiness signal; for a daily period it's
  // bars that belong to *that* period (not stale ones from the prior selection).
  // Until ready we show a skeleton rather than stale or empty content.
  const dailyLoaded = isDailyPeriod(timeframe) && barsPeriod === timeframe;
  const ready = showIntraday ? intraday != null : dailyLoaded;

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

        {/* Chart — reflects the selected timeframe */}
        <View>
          <Text className="mb-2 text-xs uppercase text-muted-foreground">{chartLabel}</Text>
          {!ready ? (
            <ChartSkeleton />
          ) : showIntraday ? (
            intradayPoints.length > 1 ? (
              <IntradayChart
                points={intraday!.points}
                previousClose={intraday!.previousClose}
                color={intradayColor}
                baselineColor={theme.mutedForeground}
              />
            ) : (
              <ChartPlaceholder label="No intraday data" />
            )
          ) : bars.length > 1 ? (
            <DailyChart bars={bars} color={dailyColor} baselineColor={theme.mutedForeground} />
          ) : (
            <ChartPlaceholder label="No data" />
          )}
        </View>

        {/* Timeframe selector + stats */}
        <View>
          <View className="mb-2 flex-row gap-2">
            {TIMEFRAMES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setTimeframe(option)}
                className={cn('rounded-md px-3 py-1', option === timeframe && 'bg-accent')}>
                <Text
                  className={cn(
                    'text-xs',
                    option === timeframe ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
          {!ready ? (
            <StatGridSkeleton tiles={showIntraday ? 4 : 5} />
          ) : showIntraday ? (
            intradayStats ? (
              <IntradayGrid stats={intradayStats} />
            ) : (
              <Text className="text-sm text-muted-foreground">No intraday data</Text>
            )
          ) : movement ? (
            <MovementGrid stats={movement} />
          ) : (
            <Text className="text-sm text-muted-foreground">No data</Text>
          )}
        </View>

        {/* Indicators */}
        {snapshot && <Indicators snapshot={snapshot} theme={theme} />}
      </ScrollView>
    </>
  );
}

function ChartPlaceholder({ label }: { label: string }) {
  return (
    <View style={{ height: 180 }} className="items-center justify-center">
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </View>
  );
}

/** Loading state for the chart — a readout-line block over a chart-height block. */
function ChartSkeleton() {
  return (
    <View>
      <Skeleton width={140} height={18} style={{ marginBottom: 8 }} />
      <Skeleton height={180} />
    </View>
  );
}

/** Loading state for the stat grid — tile-shaped blocks matching `StatTile`. */
function StatGridSkeleton({ tiles }: { tiles: number }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {Array.from({ length: tiles }).map((_, i) => (
        <Skeleton key={i} height={62} radius={8} style={{ minWidth: '30%', flexGrow: 1 }} />
      ))}
    </View>
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
