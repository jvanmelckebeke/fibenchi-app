import { useRouter } from 'expo-router';
import {
  ArrowRightFromLine,
  ArrowRightToLine,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { rampColor, type ColorMode } from '@/lib/board-scale';
import type { BoardTile as Tile } from '@/lib/board';
import { signedPercent, trendColor } from '@/lib/format';
import type { MarketState } from '@/lib/market';
import { MOVER_WINDOWS } from '@/lib/movers';
import { formatSigma } from '@/lib/sigma-ramp';
import { useTheme } from '@/lib/theme';

/** The web board's phase glyphs, so a tile reads the same on both. */
const PHASE_ICON: Record<MarketState, LucideIcon> = {
  regular: Sun,
  pre: ArrowRightToLine,
  post: ArrowRightFromLine,
  closed: Moon,
};

/** The web tile's bar fills (Tailwind emerald-300 / rose-300) and its 12% stub. */
const BAR_UP = '#6ee7b7';
const BAR_DOWN = '#fda4af';
const MIN_FILL = 0.12;

interface BoardRowProps {
  tile: Tile;
  mode: ColorMode;
  span: number;
  fresh: boolean;
}

/**
 * One asset per row: the web board's tile laid out for a phone's width. Left is
 * what the tile shows (ticker, phase glyph, σ or today's %, on the ramp
 * colour); right is the tile's window strip with its numbers written in, since
 * a phone has no hover for the web's tooltip.
 */
export function BoardRow({ tile, mode, span, fresh }: BoardRowProps) {
  const router = useRouter();
  const theme = useTheme();
  const { asset, value, windows } = tile;
  const ramp = value !== null ? rampColor(value, span) : null;
  const pending = asset.sigma === null && asset.unscored === null;
  const ink = ramp?.ink ?? theme.foreground;
  const Phase = asset.quote ? PHASE_ICON[asset.quote.marketState] : null;
  const reading =
    value === null
      ? mode === 'pct'
        ? '—'
        : pending
          ? '…'
          : '—σ'
      : mode === 'sigma'
        ? formatSigma(value)
        : signedPercent(value, 1);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/asset/[symbol]', params: { symbol: asset.symbol } })}
      style={{ backgroundColor: ramp?.color ?? 'transparent', opacity: fresh ? 1 : 0.55 }}
      className={
        ramp
          ? 'flex-row items-center rounded-lg px-3 py-2'
          : 'flex-row items-center rounded-lg border border-border px-3 py-2'
      }>
      <View className="w-[42%] pr-2">
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ color: ink }}
            className="shrink text-sm font-semibold">
            {asset.symbol}
          </Text>
          {Phase && <Phase size={11} color={ink} strokeWidth={2.25} />}
        </View>
        <View className="flex-row items-baseline gap-1.5">
          <Text style={{ color: ink }} className="text-lg font-semibold">
            {reading}
          </Text>
          {/* σ mode still says today's %: the row has room the tile didn't. */}
          {mode === 'sigma' && asset.changePct !== null && (
            <Text
              style={{
                color: ramp ? ink : trendColor(asset.changePct, theme),
                opacity: ramp ? 0.8 : 1,
              }}
              className="text-xs">
              {signedPercent(asset.changePct, 1)}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-1 flex-row gap-2">
        {MOVER_WINDOWS.map((w) => {
          const pct = windows[w.value];
          const fill = pct === null ? 0 : Math.max(MIN_FILL, Math.min(1, Math.abs(pct) / w.maxAbs));
          return (
            <View key={w.value} className="flex-1">
              <Text style={{ color: ink, opacity: 0.7 }} className="text-[10px]">
                {w.label}
              </Text>
              <Text style={{ color: ink }} className="text-xs font-medium">
                {pct === null ? '—' : signedPercent(pct, 1)}
              </Text>
              <View
                className="mt-1 h-[3px] overflow-hidden rounded-full"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                {pct !== null && (
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${fill * 100}%`,
                      backgroundColor: pct >= 0 ? BAR_UP : BAR_DOWN,
                    }}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}
