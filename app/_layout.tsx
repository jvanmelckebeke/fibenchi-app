import '@/global.css';

import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GroupDrawer } from '@/components/group-drawer';
import { ConfigProvider } from '@/lib/config/provider';
import { NAV_THEME } from '@/lib/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  // Dark-first: fall back to dark when the system scheme is unset.
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme ?? 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={NAV_THEME[scheme]}>
        <ConfigProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Drawer drawerContent={(props) => <GroupDrawer {...props} />}>
            <Drawer.Screen name="index" options={{ title: 'Fibenchi' }} />
          </Drawer>
          <PortalHost />
        </ConfigProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
