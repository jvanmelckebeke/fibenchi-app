import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { GroupDrawer } from './group-drawer';

// A book with more groups than fit on a phone screen must still reach the
// Settings link at the bottom, so the drawer's content has to be able to grow
// past the screen and scroll.

jest.mock('@react-navigation/drawer', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { DrawerContentScrollView: ScrollView };
});
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/components/ui/text', () => ({ Text: jest.requireActual('react-native').Text }));

const mockGroups = Array.from({ length: 30 }, (_, i) => ({ name: `Group ${i}`, symbols: ['A'] }));

jest.mock('@/lib/config/provider', () => ({
  useConfig: () => ({
    config: { groups: mockGroups },
    activeGroup: null,
    setActiveGroup: jest.fn(),
    lastSyncedAt: null,
    status: 'idle',
  }),
}));
jest.mock('@/lib/config', () => ({
  orderedGroups: (config: { groups: unknown[] }) => config.groups,
}));

it('lets a long group list scroll down to Settings', async () => {
  const props = {
    navigation: { closeDrawer: jest.fn() },
  } as unknown as DrawerContentComponentProps;
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    root = TestRenderer.create(<GroupDrawer {...props} />);
  });
  const { ScrollView } = jest.requireActual('react-native');
  const container = StyleSheet.flatten(
    root.root.findByType(ScrollView).props.contentContainerStyle
  );
  // flex: 1 pins the content to the viewport's height, so nothing past it scrolls into view.
  expect(container.flex).toBeUndefined();
  expect(container.flexGrow).toBe(1);
  expect(root.root.findAll((node) => node.props.children === 'Settings').length).toBeGreaterThan(0);
});
