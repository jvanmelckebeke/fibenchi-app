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
  /** Foreground content (the card). Stays put; panels slide over its edges. */
  children: React.ReactNode;
  /** Panel revealed over the right of the foreground by swiping left. */
  reveal?: React.ReactNode;
  /** Panel revealed over the left of the foreground by swiping right. */
  revealLeft?: React.ReactNode;
  /** Panel width as a fraction of the row (0..1). Default 0.6. */
  openFraction?: number;
  style?: StyleProp<ViewStyle>;
}

// A single eased settle — no spring overshoot (a bouncy snap-back reads as toy-like).
const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

/**
 * Swipe to slide a compact panel in over an edge of the row (the card stays
 * put, so the rest of it stays visible as context). Swipe left for the right
 * panel (`reveal`), swipe right for the left panel (`revealLeft`) — one signed
 * `progress` covers both: -1 (left open) → 0 (closed) → 1 (right open), kept
 * width-independent. Built on the modern `Gesture.Pan` + Reanimated rather than
 * gesture-handler's deprecated `Swipeable`. `activeOffsetX` + `failOffsetY` keep
 * the horizontal swipe from fighting the vertical list scroll. Panels are
 * mounted only while open or dragging, so a closed row pays nothing for what's
 * behind it. Tap a panel to close it.
 */
export function SwipeReveal({
  children,
  reveal,
  revealLeft,
  openFraction = 0.6,
  style,
}: SwipeRevealProps) {
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const w = useSharedValue(0);
  const progress = useSharedValue(0);
  const startProgress = useSharedValue(0);

  // A missing panel pins that end of the progress range to 0, so you can't
  // drag toward a side that has nothing behind it.
  const min = revealLeft ? -1 : 0;
  const max = reveal ? 1 : 0;

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
      // Swiping left (negative translation) drives progress up toward the
      // right panel; swiping right drives it down toward the left panel.
      const raw = startProgress.value + -event.translationX / panelW;
      progress.value = Math.min(max, Math.max(min, raw));
    })
    .onEnd((event) => {
      // Settle on the nearest stop, with a fast fling overriding position.
      let target = Math.round(progress.value);
      if (event.velocityX < -500) target = Math.ceil(progress.value);
      else if (event.velocityX > 500) target = Math.floor(progress.value);
      target = Math.min(max, Math.max(min, target));
      progress.value = withTiming(target, SETTLE, (finished) => {
        if (finished && target === 0) runOnJS(setActive)(false);
      });
    });

  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * w.value * openFraction }],
  }));
  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (-1 - progress.value) * w.value * openFraction }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[style, { overflow: 'hidden' }]} onLayout={onLayout}>
        {children}
        {active && width > 0 && reveal && (
          <Animated.View
            style={[
              { position: 'absolute', right: 0, top: 0, bottom: 0, width: width * openFraction },
              rightStyle,
            ]}>
            <Pressable onPress={close} style={{ flex: 1 }} android_disableSound>
              {reveal}
            </Pressable>
          </Animated.View>
        )}
        {active && width > 0 && revealLeft && (
          <Animated.View
            style={[
              { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * openFraction },
              leftStyle,
            ]}>
            <Pressable onPress={close} style={{ flex: 1 }} android_disableSound>
              {revealLeft}
            </Pressable>
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}
