import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useConfig } from '@/lib/config/provider';
import { formatTimestamp } from '@/lib/date';

export default function Settings() {
  const { endpoint, lastSyncedAt, status, error, sync, setEndpoint } = useConfig();
  const [url, setUrl] = useState(endpoint ?? '');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const save = async () => {
    setSaveMessage(null);
    const result = await setEndpoint(url);
    setSaveMessage(result.ok ? 'Saved.' : (result.error ?? 'Failed.'));
  };

  return (
    <View className="flex-1 gap-6 p-6">
      <View className="gap-2">
        <Text className="text-xs uppercase text-muted-foreground">Fibenchi endpoint</Text>
        <Input
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://..."
        />
        <Button onPress={save}>
          <Text>Save endpoint</Text>
        </Button>
        {saveMessage && <Text className="text-xs text-muted-foreground">{saveMessage}</Text>}
      </View>

      <View className="gap-2">
        <Text className="text-xs uppercase text-muted-foreground">Sync</Text>
        <Text className="text-sm text-muted-foreground">
          Last synced: {lastSyncedAt ? formatTimestamp(lastSyncedAt) : 'never'}
        </Text>
        {status === 'error' && error && <Text className="text-sm text-loss">{error}</Text>}
        <Button variant="secondary" onPress={sync} disabled={status === 'syncing'}>
          <Text>{status === 'syncing' ? 'Syncing…' : 'Sync now'}</Text>
        </Button>
      </View>
    </View>
  );
}
