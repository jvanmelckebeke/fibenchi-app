import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { PulseAsset } from '@/lib/pulse';
import { sigmaBarColor } from '@/lib/sigma-ramp';

interface TailStripProps {
  assets: PulseAsset[];
  dim: boolean;
  onPress: () => void;
}

/**
 * Everything past the five, as one 6px bar per asset coloured by its σ, then
 * `36 more ›`.
 *
 * Deliberately **not** a second list. Ranks 6–13 as slim rows was prototyped and
 * costs no extra fetches, but it contradicts the screen's whole claim: empty
 * space is the correct output of "these are the only five things worth your
 * attention." On a quiet day the bars all go grey, which is the day describing
 * itself with no special case anywhere in the code.
 */
export function TailStrip({ assets, dim, onPress }: TailStripProps) {
  if (assets.length === 0) return null;
  return (
    <Pressable onPress={onPress} className="mx-4 mt-3 flex-row items-center gap-3">
      <View className="flex-1 flex-row items-end gap-[2px]" style={{ opacity: dim ? 0.5 : 1 }}>
        {assets.map((asset) => (
          <View
            key={asset.symbol}
            // 6px as specified, but flexible: a 40-name tail would otherwise
            // push the `N more` label off a phone width.
            style={{
              flex: 1,
              maxWidth: 6,
              minWidth: 2,
              height: 18,
              borderRadius: 2,
              backgroundColor: sigmaBarColor(asset.score),
            }}
          />
        ))}
      </View>
      <Text className="text-xs text-muted-foreground">{assets.length} more ›</Text>
    </Pressable>
  );
}
