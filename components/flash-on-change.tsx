import { useColorScheme } from 'nativewind';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { THEME } from '@/lib/theme';

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
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const previous = useRef<number | null>(null);
  const opacity = useSharedValue(0);
  const rising = useSharedValue(1);

  useEffect(() => {
    if (value == null) return;
    const prev = previous.current;
    if (prev != null && value !== prev) {
      rising.value = value > prev ? 1 : 0;
      opacity.value = withSequence(
        withTiming(0.4, { duration: 90 }),
        withTiming(0, { duration: 480 })
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
