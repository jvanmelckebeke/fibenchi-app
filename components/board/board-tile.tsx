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
import { formatSigma } from '@/lib/sigma-ramp';
import { useTheme } from '@/lib/theme';

/** The web board's phase glyphs, so a tile reads the same on both. */
export const PHASE_ICON: Record<MarketState, LucideIcon> = {
  regular: Sun,
  pre: ArrowRightToLine,
  post: ArrowRightFromLine,
  closed: Moon,
};

interface BoardTileProps {
  tile: Tile;
  mode: ColorMode;
  span: number;
  width: number;
  /** False when the book is stale: the tile dims as a whole. */
  fresh: boolean;
}

/**
 * One asset: ticker, its reading, and the venue's phase in the corner, on the
 * ramp colour. A tile with no reading stays off the ramp and says why in one
 * glyph: `…` while its bars load, `—σ` plus today's % when it can't be scored.
 */
export function BoardTile({ tile, mode, span, width, fresh }: BoardTileProps) {
  const router = useRouter();
  const theme = useTheme();
  const { asset, value } = tile;
  const ramp = value !== null ? rampColor(value, span) : null;
  const pending = asset.sigma === null && asset.unscored === null;
  const phase = asset.quote ? PHASE_ICON[asset.quote.marketState] : null;
  const ink = ramp?.ink ?? theme.mutedForeground;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/asset/[symbol]', params: { symbol: asset.symbol } })}
      accessibilityLabel={`${asset.symbol} ${label(tile, mode) ?? 'no reading'}`}
      style={{
        width,
        backgroundColor: ramp?.color ?? 'transparent',
        opacity: fresh ? 1 : 0.55,
      }}
      className={
        ramp ? 'rounded-md px-1.5 py-1.5' : 'rounded-md border border-border px-1.5 py-1.5'
      }>
      <View className="flex-row items-center justify-between gap-1">
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{ color: ramp ? ramp.ink : theme.foreground }}
          className="flex-1 text-[11px] font-semibold">
          {asset.symbol}
        </Text>
        {phase && <PhaseGlyph icon={phase} color={ink} />}
      </View>
      <Text style={{ color: ink }} className="mt-0.5 text-[13px] font-semibold">
        {label(tile, mode) ?? (mode === 'pct' ? '—' : pending ? '…' : '—σ')}
      </Text>
      {/* Scored nothing, but today's % is still worth seeing (web does the same). */}
      {ramp === null && !pending && mode === 'sigma' && asset.changePct !== null && (
        <Text style={{ color: trendColor(asset.changePct, theme) }} className="text-[10px]">
          {signedPercent(asset.changePct, 1)}
        </Text>
      )}
    </Pressable>
  );
}

function label({ value }: Tile, mode: ColorMode): string | null {
  if (value === null) return null;
  return mode === 'sigma' ? formatSigma(value) : signedPercent(value, 1);
}

function PhaseGlyph({ icon: Glyph, color }: { icon: LucideIcon; color: string }) {
  return <Glyph size={10} color={color} strokeWidth={2.25} />;
}
