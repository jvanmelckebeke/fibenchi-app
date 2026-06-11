import { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/lib/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Corner radius; defaults to the 6px used by the app's small surfaces. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A pulsing placeholder block (muted fill, opacity breathing 0.5 ↔ 1) for
 * content that is loading. Reanimated-driven — same approach as `FlashOnChange`
 * — since RN/NativeWind don't run CSS keyframe animations. Style-driven (no
 * `className`) so it composes cleanly with the `Animated.View` it renders.
 */
export function Skeleton({ width = '100%', height, radius = 6, style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.muted }, pulse, style]}
    />
  );
}
