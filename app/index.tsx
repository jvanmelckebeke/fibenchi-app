import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Stack } from 'expo-router';
import { MoonStarIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';

const SCREEN_OPTIONS = {
  title: 'Fibenchi',
  headerTransparent: true,
  headerRight: () => <ThemeToggle />,
};

export default function Screen() {
  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-2xl font-semibold text-foreground">Fibenchi</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Companion scaffold ready. The overview lands in a later epic.
        </Text>
        {/* Quick smoke-test that the finance color tokens resolve */}
        <View className="flex-row gap-4">
          <Text className="text-sm text-gain">▲ gain</Text>
          <Text className="text-sm text-loss">▼ loss</Text>
          <Text className="text-sm text-flat">— flat</Text>
        </View>
      </View>
    </>
  );
}

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
};

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button
      onPressIn={toggleColorScheme}
      size="icon"
      variant="ghost"
      className="ios:size-9 rounded-full web:mx-4">
      <Icon as={THEME_ICONS[colorScheme ?? 'dark']} className="size-5" />
    </Button>
  );
}
