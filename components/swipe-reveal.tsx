import { useCallback, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface SwipeRevealProps {
  /** Foreground content (the card). Stays put; the panel slides over its right. */
  children: React.ReactNode;
  /** Panel revealed over the right of the foreground. Mounted only while open/dragging. */
  reveal: React.ReactNode;
  /** Panel width as a fraction of the row (0..1). Default 0.6. */
  openFraction?: number;
  style?: StyleProp<ViewStyle>;
}

// A single eased settle — no spring overshoot (a bouncy snap-back reads as toy-like).
const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

/**
 * Swipe-left to slide a compact panel in over the right of the row (the card
 * stays put, so its left-hand identity stays visible as context). Built on the
 * modern `Gesture.Pan` + Reanimated rather than gesture-handler's deprecated
 * `Swipeable`. `activeOffsetX` + `failOffsetY` keep the horizontal swipe from
 * fighting the vertical list scroll. The panel is mounted only while open or
 * dragging, so a closed row pays nothing for what's behind it. Tap the panel to
 * close. `progress` is 0 (closed) → 1 (open), kept width-independent.
 */
export function SwipeReveal({ children, reveal, openFraction = 0.6, style }: SwipeRevealProps) {
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const w = useSharedValue(0);
  const progress = useSharedValue(0);
  const startProgress = useSharedValue(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const lw = event.nativeEvent.layout.width;
    w.value = lw;
    setWidth((prev) => (prev === lw ? prev : lw));
  }, [w]);

  const close = useCallback(() => {
    progress.value = withTiming(0, SETTLE, (finished) => {
      if (finished) runOnJS(setActive)(false);
    });
  }, [progress]);

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-15, 15])
    .onStart(() => {
      startProgress.value = progress.value;
      runOnJS(setActive)(true);
    })
    .onUpdate((event) => {
      const panelW = w.value * openFraction;
      if (panelW <= 0) return;
      // Swiping left (negative translation) opens.
      progress.value = Math.min(1, Math.max(0, startProgress.value + -event.translationX / panelW));
    })
    .onEnd((event) => {
      const open = event.velocityX <= 500 && (progress.value > 0.5 || event.velocityX < -500);
      progress.value = withTiming(open ? 1 : 0, SETTLE, (finished) => {
        if (finished && !open) runOnJS(setActive)(false);
      });
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * w.value * openFraction }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[style, { overflow: 'hidden' }]} onLayout={onLayout}>
        {children}
        {active && width > 0 && (
          <Animated.View
            style={[
              { position: 'absolute', right: 0, top: 0, bottom: 0, width: width * openFraction },
              panelStyle,
            ]}>
            <Pressable onPress={close} style={{ flex: 1 }} android_disableSound>
              {reveal}
            </Pressable>
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}
