import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useConfig } from '@/lib/config/provider';
import { formatTimestamp } from '@/lib/date';
import { cn } from '@/lib/utils';

/** Drawer content: the group switcher + a Settings link and sync status. */
export function GroupDrawer(props: DrawerContentComponentProps) {
  const { config, activeGroup, setActiveGroup, lastSyncedAt, status } = useConfig();
  const groups = config?.groups ?? [];

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <Text className="px-4 pb-3 pt-2 text-xl font-bold text-foreground">Fibenchi</Text>

      {groups.map((group) => {
        const active = group.name === activeGroup;
        return (
          <Pressable
            key={group.name}
            onPress={() => {
              setActiveGroup(group.name);
              props.navigation.closeDrawer();
            }}
            className={cn(
              'mx-2 my-0.5 flex-row items-center justify-between rounded-lg px-3 py-3',
              active && 'bg-accent'
            )}>
            <Text className={cn('text-base', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {group.name}
            </Text>
            <Text className="text-xs text-muted-foreground">{group.symbols?.length ?? 0}</Text>
          </Pressable>
        );
      })}
      {groups.length === 0 && (
        <View className="px-4 py-3">
          <Text className="text-sm text-muted-foreground">No groups yet.</Text>
        </View>
      )}

      <View className="mt-auto border-t border-border px-2 pt-2">
        <Pressable
          onPress={() => {
            props.navigation.closeDrawer();
            router.push('/settings');
          }}
          className="my-0.5 rounded-lg px-3 py-3">
          <Text className="text-base text-muted-foreground">Settings</Text>
        </Pressable>
        <Text className="px-3 pb-2 text-xs text-muted-foreground">
          {status === 'syncing'
            ? 'Syncing…'
            : lastSyncedAt
              ? `Synced ${formatTimestamp(lastSyncedAt)}`
              : 'Not synced'}
        </Text>
      </View>
    </DrawerContentScrollView>
  );
}
