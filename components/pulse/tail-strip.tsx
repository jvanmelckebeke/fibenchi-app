import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { PulseAsset } from '@/lib/pulse';
import { sigmaBarColor } from '@/lib/sigma-ramp';
import { TAIL_BAR, TAIL_GAP, tailBarCount } from '@/lib/tail-bars';

interface TailStripProps {
  assets: PulseAsset[];
  dim: boolean;
  onPress: () => void;
}

/**
 * Reserved for the label so its own width can't feed back into the bar count.
 * The track is `flex-1`, so a shorter string would widen the track, fit another
 * bar, shorten the string again — a layout that oscillates on every digit
 * boundary. Fixing the column breaks the loop.
 */
const LABEL_WIDTH = 68;

/**
 * Everything past the five, as one bar per asset coloured by its σ, then
 * `39 more ›`.
 *
 * Deliberately **not** a second list. Ranks 6–13 as slim rows was prototyped and
 * costs no extra fetches, but it contradicts the screen's whole claim: empty
 * space is the correct output of "these are the only five things worth your
 * attention."
 *
 * The strip fills the measured track at full bar width and stops, rather than
 * dividing itself among every asset. An 84-symbol book leaves a 71-bar tail,
 * which on a phone meant ~2.7px slivers — and the names being squeezed for were
 * the near-zero ones, whose bars are grey by construction and say nothing. The
 * tail arrives |σ|-desc, so drawing a prefix keeps the extremes and sheds the
 * grey without a threshold to tune. What's left over is what the label counts.
 */
export function TailStrip({ assets, dim, onPress }: TailStripProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  if (assets.length === 0) return null;

  const drawn = tailBarCount(trackWidth, assets.length);
  const remaining = assets.length - drawn;

  return (
    <Pressable onPress={onPress} className="mx-4 mt-3 flex-row items-center gap-3">
      <View
        className="flex-1 flex-row items-end overflow-hidden"
        style={{ gap: TAIL_GAP, opacity: dim ? 0.5 : 1 }}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {assets.slice(0, drawn).map((asset) => (
          <View
            key={asset.symbol}
            style={{
              width: TAIL_BAR,
              height: 18,
              borderRadius: 2,
              backgroundColor: sigmaBarColor(asset.score),
            }}
          />
        ))}
      </View>
      <Text
        className="shrink-0 text-right text-xs text-muted-foreground"
        style={{ width: LABEL_WIDTH }}
      >
        {/* Nothing is hidden once the whole tail is drawn, so the label stops
            claiming a remainder and just offers the way through. */}
        {remaining > 0 ? `${remaining} more ›` : 'see all ›'}
      </Text>
    </Pressable>
  );
}
