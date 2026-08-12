import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { MarketState } from '@/lib/market';
import { useTheme } from '@/lib/theme';

/**
 * The 2.4s ping, shared by every dot on the screen. A module-level clock rather
 * than per-dot timing: independently started animations read as twinkling noise,
 * where one synchronised pulse reads as a single system being alive.
 */
const PING_MS = 2_400;
const DOT = 6;

interface MarketDotProps {
  state: MarketState | undefined;
  /**
   * When false, the dot goes hollow and stops — offline. The ping is a claim
   * about *our data*, not about the exchange: a pinging "open" dot on frozen
   * numbers would be reporting the wrong one of those two facts.
   */
  fresh: boolean;
}

export function MarketDot({ state, fresh }: MarketDotProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const open = state === 'regular';

  useEffect(() => {
    let cancelled = false;
    if (!open || !fresh) {
      progress.value = 0;
      return;
    }
    // Honour reduced-motion: the colour already carries the state, the ping is
    // the glanceable extra.
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      // Phase-locked to the wall clock, so dots mounting at different times
      // (a row arriving late) still pulse together.
      const offset = Date.now() % PING_MS;
      progress.value = offset / PING_MS;
      progress.value = withRepeat(
        withTiming(progress.value + 1, {
          duration: PING_MS * (1 - offset / PING_MS),
          easing: Easing.linear,
        }),
        -1,
        false
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, fresh, progress]);

  const color = fresh
    ? {
        regular: theme.marketRegular,
        pre: theme.marketPre,
        post: theme.marketPost,
        closed: theme.marketClosed,
      }[state ?? 'closed']
    : theme.marketPost; // offline: amber, and hollow (below)

  const hollow = !fresh || state === 'closed' || state === undefined;

  const ping = useAnimatedStyle(() => {
    const phase = progress.value % 1;
    return {
      opacity: (1 - phase) * 0.45,
      transform: [{ scale: 1 + phase * 1.8 }],
    };
  });

  return (
    <View style={{ width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' }}>
      {open && fresh && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              backgroundColor: color,
            },
            ping,
          ]}
        />
      )}
      <View
        style={{
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: hollow ? 'transparent' : color,
          borderWidth: hollow ? 1 : 0,
          borderColor: color,
        }}
      />
    </View>
  );
}
