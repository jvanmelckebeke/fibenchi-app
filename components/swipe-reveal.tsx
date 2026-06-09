import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface SwipeRevealProps {
  /** Foreground content (the card). Slides left on swipe. */
  children: React.ReactNode;
  /** Panel revealed behind the foreground. Mounted only while open/dragging. */
  reveal: React.ReactNode;
  /** How far the foreground opens, as a fraction of width (0..1). Default 1 (full). */
  openFraction?: number;
  style?: StyleProp<ViewStyle>;
}

// A single eased settle — no spring overshoot (a bouncy snap-back reads as toy-like).
const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

/**
 * Swipe-left to reveal a panel behind the foreground (the RN analog of a
 * swipe-to-reveal-actions row, but for content). Built on the modern
 * `Gesture.Pan` + Reanimated rather than gesture-handler's deprecated
 * `Swipeable`. `activeOffsetX` + `failOffsetY` keep the horizontal swipe from
 * fighting a vertical list scroll. The reveal panel is mounted only while the
 * row is open or being dragged, so a closed card in a long list pays nothing
 * for what's behind it. Tapping the open panel snaps it closed.
 */
export function SwipeReveal({ children, reveal, openFraction = 1, style }: SwipeRevealProps) {
  const [active, setActive] = useState(false);
  const width = useSharedValue(0);
  const tx = useSharedValue(0);
  const start = useSharedValue(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      width.value = event.nativeEvent.layout.width;
    },
    [width]
  );

  const close = useCallback(() => {
    tx.value = withTiming(0, SETTLE, (finished) => {
      if (finished) runOnJS(setActive)(false);
    });
  }, [tx]);

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-15, 15])
    .onStart(() => {
      start.value = tx.value;
      runOnJS(setActive)(true);
    })
    .onUpdate((event) => {
      const open = width.value * openFraction;
      const next = start.value + event.translationX;
      tx.value = Math.min(0, Math.max(-open, next));
    })
    .onEnd((event) => {
      const open = width.value * openFraction;
      const shouldOpen = event.velocityX <= 500 && (tx.value < -open / 2 || event.velocityX < -500);
      tx.value = withTiming(shouldOpen ? -open : 0, SETTLE, (finished) => {
        if (finished && !shouldOpen) runOnJS(setActive)(false);
      });
    });

  const foregroundStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <View style={style} onLayout={onLayout}>
        {active && (
          <Pressable onPress={close} style={StyleSheet.absoluteFill} android_disableSound>
            {reveal}
          </Pressable>
        )}
        <Animated.View style={foregroundStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}
