import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/lib/theme';

// Flash envelope: snap up, linger at peak, then a slow fade so the tint reads as
// a deliberate pulse rather than a blink (~1.3s total).
const FLASH_PEAK = 0.45;
const RISE_MS = 120;
const HOLD_MS = 450;
const FADE_MS = 750;

interface FlashOnChangeProps {
  /** Flash fires whenever this changes: green when it rises, red when it falls. */
  value: number | null | undefined;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius of the flash overlay, to match the wrapped element. */
  radius?: number;
}

/**
 * Briefly tints its background green/red when `value` changes direction — the RN
 * analog of Fibenchi's per-tick price flash. The tint is an absolutely-positioned
 * overlay *behind* the children that fades out, so layout and text colour are
 * untouched. No flash on first paint (only on a change from a known prior value).
 */
export function FlashOnChange({ value, children, style, radius = 6 }: FlashOnChangeProps) {
  const theme = useTheme();
  const previous = useRef<number | null>(null);
  const opacity = useSharedValue(0);
  const rising = useSharedValue(1);

  useEffect(() => {
    if (value == null) return;
    const prev = previous.current;
    if (prev != null && value !== prev) {
      rising.value = value > prev ? 1 : 0;
      opacity.value = withSequence(
        withTiming(FLASH_PEAK, { duration: RISE_MS }),
        withTiming(FLASH_PEAK, { duration: HOLD_MS }),
        withTiming(0, { duration: FADE_MS })
      );
    }
    previous.current = value;
  }, [value, opacity, rising]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: rising.value === 1 ? theme.gain : theme.loss,
  }));

  return (
    <View style={style}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }, overlayStyle]}
      />
      {children}
    </View>
  );
}
