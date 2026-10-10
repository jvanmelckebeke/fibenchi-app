import { Drawer } from 'expo-router/drawer';

import { GroupDrawer } from '@/components/group-drawer';
import { useBookPolling } from '@/stores/book';

export default function DrawerLayout() {
  useBookPolling();

  return (
    <Drawer drawerContent={(props) => <GroupDrawer {...props} />}>
      <Drawer.Screen name="index" options={{ title: 'Pulse' }} />
      <Drawer.Screen name="board" options={{ title: 'Board' }} />
      <Drawer.Screen name="group" options={{ title: 'Fibenchi' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
    </Drawer>
  );
}
