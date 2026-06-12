import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/**
 * The readout column of a swipe-reveal chart panel (MACD, RSI): a fixed-width
 * stack of colour-coded value lines beside the chart. The width is shared here
 * so the two panels' charts start at the same x. The colour *is* the legend —
 * no marker glyphs.
 */
export function ReadoutColumn({ children }: { children: React.ReactNode }) {
  return <View className="w-[62px] justify-center gap-0.5">{children}</View>;
}

/** One colour-coded readout line, e.g. "MACD 1.2" or "Oversold". */
export function Readout({ color, label }: { color: string; label: string }) {
  return (
    <Text numberOfLines={1} className="text-[10px] font-medium" style={{ color }}>
      {label}
    </Text>
  );
}
