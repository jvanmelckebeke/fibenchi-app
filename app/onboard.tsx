import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useConfig } from '@/lib/config/provider';

export default function Onboard() {
  const { setEndpoint } = useConfig();
  const [url, setUrl] = useState('http://');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    const result = await setEndpoint(url);
    setBusy(false);
    if (result.ok) router.replace('/');
    else setError(result.error ?? 'Could not connect.');
  };

  return (
    <View className="flex-1 justify-center gap-4 p-6">
      <Text className="text-2xl font-bold text-foreground">Connect to Fibenchi</Text>
      <Text className="text-sm text-muted-foreground">
        Enter your Fibenchi endpoint URL. The app pulls your groups and tickers from it; live prices
        come straight from Yahoo on this device.
      </Text>
      <Input
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://..."
      />
      {error && <Text className="text-sm text-loss">{error}</Text>}
      <Button onPress={connect} disabled={busy}>
        <Text>{busy ? 'Connecting…' : 'Connect'}</Text>
      </Button>
    </View>
  );
}
