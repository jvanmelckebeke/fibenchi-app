import {
  ArrowRightFromLine,
  ArrowRightToLine,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';

import type { MarketState } from '@/lib/market';

/** The web board's phase glyphs: sun open, arrows pre/post, moon closed. */
const PHASE_ICON: Record<MarketState, LucideIcon> = {
  regular: Sun,
  pre: ArrowRightToLine,
  post: ArrowRightFromLine,
  closed: Moon,
};

interface PhaseIconProps {
  state: MarketState | undefined;
  color: string;
  size?: number;
}

/** A venue's market phase as one glyph, the same on the Pulse and the Board. */
export function PhaseIcon({ state, color, size = 11 }: PhaseIconProps) {
  if (!state) return null;
  const Glyph = PHASE_ICON[state];
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={2.25}
      accessibilityLabel={state === 'regular' ? 'open' : state}
    />
  );
}
