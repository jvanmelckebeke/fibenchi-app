import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useConfig } from '@/lib/config/provider';
import { cn } from '@/lib/utils';

/** Drawer content: the group switcher. Selecting a group sets it active + closes. */
export function GroupDrawer(props: DrawerContentComponentProps) {
  const { config, activeGroup, setActiveGroup } = useConfig();
  const groups = config?.groups ?? [];

  return (
    <DrawerContentScrollView {...props}>
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
    </DrawerContentScrollView>
  );
}
