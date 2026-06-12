import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import {
  buildIndicatorSnapshot,
  indicatorHistoryPeriod,
  macdSeries,
  rsiSeries,
  type MacdPoint,
  type RsiPoint,
} from '@/lib/compute';
import { formatPrice, sessionBadge, signedPercent, trendColor } from '@/lib/format';
import { market } from '@/lib/market';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { cn } from '@/lib/utils';
import { useQuote } from '@/stores/quotes';

import { FlashOnChange } from './flash-on-change';
import { MacdChart } from './macd-chart';
import { RsiChart } from './rsi-chart';
import { Sparkline } from './sparkline';
import { SwipeReveal } from './swipe-reveal';

interface TickerCardProps {
  symbol: string;
  name: string;
}

/**
 * One-card-per-row glance: live price + day %, sparkline, RSI. Swipe the card
 * left to reveal its 1-month MACD chart (line + signal + histogram), swipe
 * right for the 1-month RSI trail — both are too coarse to glance at as chips,
 * so they live in the reveals instead.
 */
export function TickerCard({ symbol, name }: TickerCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const quote = useQuote(symbol);

  const intraday = useAsync(() => market.getIntraday(symbol), [symbol]);
  const daily = useAsync(() => market.getDaily(symbol, indicatorHistoryPeriod()), [symbol]);

  const spark = useMemo(() => intraday?.points.map((point) => point.price) ?? [], [intraday]);
  // MACD computed over all bars (correct EMA convergence); show only the last
  // 8 days so they don't crowd the narrow reveal chart. The RSI trail is a
  // plain line, so a full month fits.
  const { rsi, macd, rsiTrail } = useMemo(() => {
    if (!daily) {
      return { rsi: null, macd: [] as MacdPoint[], rsiTrail: [] as RsiPoint[] };
    }
    const rsiValue = buildIndicatorSnapshot(daily)?.values.rsi;
    return {
      rsi: typeof rsiValue === 'number' ? rsiValue : null,
      macd: macdSeries(daily, 8),
      rsiTrail: rsiSeries(daily, 21),
    };
  }, [daily]);

  const changePct = quote?.changePercent ?? null;
  const priceColor = trendColor(changePct, theme);
  // Outside regular hours the sparkline is (partly) extended-hours data, so it
  // takes the session colour — Fibenchi's blue/orange — while the price change
  // stays green/red (it's still the regular-session move vs the previous close).
  const sparkColor = sessionBadge(quote?.marketState, theme)?.color ?? priceColor;

  return (
    <SwipeReveal
      reveal={
        <RevealPanel side="right">
          <MacdChart data={macd} />
        </RevealPanel>
      }
      revealLeft={
        <RevealPanel side="left">
          <RsiChart data={rsiTrail} />
        </RevealPanel>
      }>
      <Pressable onPress={() => router.push({ pathname: '/asset/[symbol]', params: { symbol } })}>
        {/* py-0 strips the Card primitive's py-6 — CardContent's py-3 is all
            the vertical air a list row needs. */}
        <Card className="mx-3 my-1 py-0">
          {/* px-3 overrides CardContent's px-6 — a dense list row can't afford
              24px of inner air on each side on a phone width. */}
          <CardContent className="flex-row items-center gap-3 px-3 py-3">
            {/* Edge handles — sheet-grabber-style hints that the card slides (right → RSI, left → MACD). */}
            <View className="-mr-2 h-3 w-[3px] rounded-full bg-muted-foreground opacity-20" />
            <View className="flex-1">
              {/* A wrapped or ellipsized ticker is unreadable — shrink long ones
                  (NCLR.PA, ECAR.MI) to fit on one line instead. */}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                className="text-base font-semibold text-foreground">
                {symbol}
              </Text>
              <Text numberOfLines={1} className="text-xs text-muted-foreground">
                {name}
              </Text>
              {rsi != null && (
                <Text className="mt-1 text-xs text-muted-foreground">RSI {rsi.toFixed(0)}</Text>
              )}
            </View>

            <Sparkline data={spark} color={sparkColor} />

            <FlashOnChange value={quote?.price} radius={8} style={{ minWidth: 84 }}>
              <View className="items-end px-1 py-0.5">
                <Text className="text-base font-semibold text-foreground">
                  {quote ? formatPrice(quote.price, { symbol, currency: quote.currency }) : '—'}
                </Text>
                {changePct != null && (
                  <Text className="text-sm" style={{ color: priceColor }}>
                    {signedPercent(changePct)}
                  </Text>
                )}
              </View>
            </FlashOnChange>

            <View className="-ml-2 h-3 w-[3px] rounded-full bg-muted-foreground opacity-20" />
          </CardContent>
        </Card>
      </Pressable>
    </SwipeReveal>
  );
}

/**
 * Card chrome for a reveal chart. A plain card-styled View, not <Card> — the
 * Card primitive's py-6/gap-6 crams the chart into a card-row's height. The
 * margin mirrors the card's mx-3 on the open edge. `pointerEvents="none"` keeps
 * the panel glance-only: taps/swipes fall through to close/pan rather than
 * being captured by the chart's own gestures.
 */
function RevealPanel({ side, children }: { side: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <View
      className={cn(
        'my-1 flex-1 overflow-hidden rounded-xl border border-border bg-card',
        side === 'right' ? 'mr-3' : 'ml-3'
      )}>
      <View pointerEvents="none" className="flex-1 px-3 py-2">
        {children}
      </View>
    </View>
  );
}
