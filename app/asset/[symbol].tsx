import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/** Placeholder — the full detail view (intraday line + movement + indicators) lands in #6. */
export default function AssetDetail() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-2xl font-semibold text-foreground">{symbol}</Text>
      <Text className="mt-2 text-sm text-muted-foreground">Detail view coming in #6.</Text>
    </View>
  );
}
