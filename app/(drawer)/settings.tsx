import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useConfig } from '@/lib/config/provider';
import { formatTimestamp } from '@/lib/date';
import { requestStats, type RequestStats } from '@/lib/market';

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

      <YahooRequests />
    </View>
  );
}

/**
 * Requests and non-200s over the client's rolling window, against the polling
 * rate that produced them. Yahoo publishes no rate limit for `v8/chart`, so this
 * is the only honest way to find where the unauthenticated ceiling actually is —
 * watch it while a group is open rather than guessing at a cadence.
 */
function YahooRequests() {
  const [stats, setStats] = useState<RequestStats>(requestStats);

  useEffect(() => {
    const timer = setInterval(() => setStats(requestStats()), 2_000);
    return () => clearInterval(timer);
  }, []);

  const perMinute = (stats.requests / stats.windowMs) * 60_000;
  return (
    <View className="gap-1">
      <Text className="text-xs uppercase text-muted-foreground">Yahoo requests</Text>
      <Text className="text-sm text-muted-foreground">
        {stats.requests} in the last {Math.round(stats.windowMs / 1000)}s · {perMinute.toFixed(0)}
        /min
      </Text>
      <Text className={`text-sm ${stats.failures > 0 ? 'text-loss' : 'text-muted-foreground'}`}>
        {stats.failures} non-200 ({(stats.failureRate * 100).toFixed(0)}%)
        {stats.queued > 0 ? ` · ${stats.queued} queued` : ''}
      </Text>
      {stats.circuitOpen && <Text className="text-sm text-loss">Circuit open — backing off.</Text>}
    </View>
  );
}
