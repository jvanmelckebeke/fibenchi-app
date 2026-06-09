import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { buildIndicatorSnapshot, macdSeries, type MacdPoint } from '@/lib/compute';
import { market } from '@/lib/market';
import { THEME } from '@/lib/theme';
import { useQuote } from '@/stores/quotes';

import { FlashOnChange } from './flash-on-change';
import { MacdChart } from './macd-chart';
import { Sparkline } from './sparkline';
import { SwipeReveal } from './swipe-reveal';

interface TickerCardProps {
  symbol: string;
  name: string;
}

/**
 * One-card-per-row glance: live price + day %, sparkline, RSI. Swipe the card
 * left to reveal its 1-month MACD chart (line + signal + histogram) behind it —
 * the MACD direction is too coarse to glance at as a chip, so it lives in the
 * reveal instead.
 */
export function TickerCard({ symbol, name }: TickerCardProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const quote = useQuote(symbol);

  const [spark, setSpark] = useState<number[]>([]);
  const [rsi, setRsi] = useState<number | null>(null);
  const [macd, setMacd] = useState<MacdPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    market
      .getIntraday(symbol)
      .then((result) => {
        if (!cancelled) setSpark(result.points.map((point) => point.price));
      })
      .catch(() => {});
    market
      .getDaily(symbol, '6mo')
      .then((bars) => {
        if (cancelled) return;
        const snapshot = buildIndicatorSnapshot(bars);
        const rsiValue = snapshot?.values.rsi;
        setRsi(typeof rsiValue === 'number' ? rsiValue : null);
        // MACD computed over all bars (correct EMA convergence); show only the
        // last ~10 days so they don't crowd the narrow reveal chart.
        setMacd(macdSeries(bars, 10));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const changePct = quote?.changePercent ?? null;
  const up = (changePct ?? 0) >= 0;
  const trendColor = up ? theme.gain : theme.loss;

  return (
    <SwipeReveal
      reveal={
        <Card className="my-1 mr-3 flex-1 overflow-hidden">
          {/* Glance-only: let taps/swipes fall through to close/pan, not the chart's own gestures. */}
          <View pointerEvents="none" className="flex-1 py-1.5 pl-2 pr-3">
            <MacdChart data={macd} />
          </View>
        </Card>
      }>
      <Pressable onPress={() => router.push({ pathname: '/asset/[symbol]', params: { symbol } })}>
        <Card className="mx-3 my-1">
          <CardContent className="flex-row items-center gap-3 py-3">
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">{symbol}</Text>
              <Text numberOfLines={1} className="text-xs text-muted-foreground">
                {name}
              </Text>
              {rsi != null && (
                <Text className="mt-1 text-xs text-muted-foreground">RSI {rsi.toFixed(0)}</Text>
              )}
            </View>

            <Sparkline data={spark} color={trendColor} />

            <FlashOnChange value={quote?.price} radius={8} style={{ minWidth: 84 }}>
              <View className="items-end px-1 py-0.5">
                <Text className="text-base font-semibold text-foreground">
                  {quote ? quote.price.toFixed(2) : '—'}
                </Text>
                {changePct != null && (
                  <Text className="text-sm" style={{ color: trendColor }}>
                    {up ? '+' : ''}
                    {changePct.toFixed(2)}%
                  </Text>
                )}
              </View>
            </FlashOnChange>

            {/* Swipe-left affordance for the MACD reveal. */}
            <Text className="-ml-1 text-xs text-muted-foreground opacity-40">‹</Text>
          </CardContent>
        </Card>
      </Pressable>
    </SwipeReveal>
  );
}
