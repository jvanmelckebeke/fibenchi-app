import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { buildIndicatorSnapshot } from '@/lib/compute';
import { market } from '@/lib/market';
import { THEME } from '@/lib/theme';
import { useQuote } from '@/stores/quotes';

import { Sparkline } from './sparkline';

interface TickerCardProps {
  symbol: string;
  name: string;
}

/** One-card-per-row glance: live price + day %, sparkline, RSI, MACD direction. */
export function TickerCard({ symbol, name }: TickerCardProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const quote = useQuote(symbol);

  const [spark, setSpark] = useState<number[]>([]);
  const [rsi, setRsi] = useState<number | null>(null);
  const [macdDir, setMacdDir] = useState<string | null>(null);

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
        const dir = snapshot?.values.macd_signal_dir;
        setRsi(typeof rsiValue === 'number' ? rsiValue : null);
        setMacdDir(typeof dir === 'string' ? dir : null);
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
    <Pressable onPress={() => router.push({ pathname: '/asset/[symbol]', params: { symbol } })}>
      <Card className="mx-3 my-1">
        <CardContent className="flex-row items-center gap-3 py-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">{symbol}</Text>
            <Text numberOfLines={1} className="text-xs text-muted-foreground">
              {name}
            </Text>
            <View className="mt-1 flex-row items-center gap-3">
              {rsi != null && <Text className="text-xs text-muted-foreground">RSI {rsi.toFixed(0)}</Text>}
              {macdDir && (
                <Text className="text-xs" style={{ color: macdDir === 'bullish' ? theme.gain : theme.loss }}>
                  MACD {macdDir === 'bullish' ? '▲' : '▼'}
                </Text>
              )}
            </View>
          </View>

          <Sparkline data={spark} color={trendColor} />

          <View className="items-end" style={{ minWidth: 84 }}>
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
        </CardContent>
      </Card>
    </Pressable>
  );
}
