import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Sparkline } from '@/components/sparkline';
import { Text } from '@/components/ui/text';
import { formatPrice, sessionBadge, signedPercent, trendColor } from '@/lib/format';
import { market } from '@/lib/market';
import type { PulseAsset } from '@/lib/pulse';
import { SIGMA_LABEL, formatSigma, sigmaChipStyle } from '@/lib/sigma-ramp';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { MarketDot } from './market-dot';

interface SigmaRowProps {
  asset: PulseAsset;
  /** False when the screen's data is stale — the row desaturates as a whole. */
  fresh: boolean;
}

/**
 * One of the five: σ chip, symbol + market dot, sparkline, price and day %.
 *
 * The asset's **name is deliberately absent** — it's 44 tickers Jari knows by
 * heart, and the name was the row's real filler. The second line appears *only*
 * when the number isn't from a live session, because that's the one thing the
 * row's own dot and price can't say; open rows are correspondingly shorter, and
 * variable row height for informational reasons is fine.
 */
export function SigmaRow({ asset, fresh }: SigmaRowProps) {
  const router = useRouter();
  const theme = useTheme();
  const { symbol, quote, score, stamp, price, changePct } = asset;

  // Only the five ranked rows pull a minute series — that's the fetch budget
  // reason the screen shows five live rows and a static strip, not 44 tiles.
  const intraday = useAsync(() => market.getIntraday(symbol), [symbol]);
  const spark = useMemo(() => intraday?.points.map((point) => point.price) ?? [], [intraday]);

  const priceColor = trendColor(changePct, theme);
  // Outside regular hours the sparkline is (partly) extended-hours data, so it
  // takes the session colour, exactly as TickerCard does.
  const sparkColor = fresh
    ? (sessionBadge(quote?.marketState, theme)?.color ?? priceColor)
    : theme.flat;

  const chip = score !== null ? sigmaChipStyle(score) : null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/asset/[symbol]', params: { symbol } })}
      className="mx-3 my-1 flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
      {chip && (
        <View
          style={{
            backgroundColor: chip.background,
            borderWidth: chip.rim ? 1 : 0,
            borderColor: chip.rim ?? 'transparent',
            opacity: fresh ? 1 : 0.55,
          }}
          className="min-w-[52px] items-center rounded-lg px-2 py-1.5">
          <Text style={{ color: SIGMA_LABEL }} className="text-base font-semibold">
            {formatSigma(score!)}
          </Text>
        </View>
      )}

      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            className="text-base font-semibold text-foreground">
            {symbol}
          </Text>
          <MarketDot state={quote?.marketState} fresh={fresh} />
        </View>
        {stamp && <Text className="text-xs text-muted-foreground">{stamp}</Text>}
      </View>

      <Sparkline data={spark} color={sparkColor} width={62} height={30} />

      <View className="items-end" style={{ opacity: fresh ? 1 : 0.6 }}>
        <Text className="text-base font-semibold text-foreground">
          {price !== null
            ? formatPrice(price, { symbol, currency: quote?.currency ?? 'USD' })
            : '—'}
        </Text>
        {changePct != null && (
          <Text className="text-sm" style={{ color: fresh ? priceColor : theme.flat }}>
            {signedPercent(changePct)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
