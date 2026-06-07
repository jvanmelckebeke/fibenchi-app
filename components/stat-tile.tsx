import { View } from 'react-native';

import { Text } from '@/components/ui/text';

interface StatTileProps {
  label: string;
  value: string;
  color?: string;
}

/** Compact labelled stat used in the movement + indicator grids. */
export function StatTile({ label, value, color }: StatTileProps) {
  return (
    <View className="min-w-[30%] flex-1 rounded-lg bg-card p-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-base font-semibold text-foreground" style={color ? { color } : undefined}>
        {value}
      </Text>
    </View>
  );
}
