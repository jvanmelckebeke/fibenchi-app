import '@/global.css';

import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
          {/* Root stack: the drawer group is the home; asset detail pushes on top
              (so it gets a back button + native swipe-back, which a drawer can't). */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(drawer)" />
            <Stack.Screen name="onboard" />
            <Stack.Screen name="asset/[symbol]" options={{ headerShown: true, title: '' }} />
          </Stack>
          <PortalHost />
        </ConfigProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
