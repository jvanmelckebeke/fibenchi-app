import { Drawer } from 'expo-router/drawer';

import { GroupDrawer } from '@/components/group-drawer';

export default function DrawerLayout() {
  return (
    <Drawer drawerContent={(props) => <GroupDrawer {...props} />}>
      <Drawer.Screen name="index" options={{ title: 'Fibenchi' }} />
    </Drawer>
  );
}
