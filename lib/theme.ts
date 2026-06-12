import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';

export const THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(0 0% 3.9%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(0 0% 3.9%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(0 0% 3.9%)',
    primary: 'hsl(0 0% 9%)',
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(0 0% 96.1%)',
    secondaryForeground: 'hsl(0 0% 9%)',
    muted: 'hsl(0 0% 96.1%)',
    mutedForeground: 'hsl(0 0% 45.1%)',
    accent: 'hsl(0 0% 96.1%)',
    accentForeground: 'hsl(0 0% 9%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    border: 'hsl(0 0% 89.8%)',
    input: 'hsl(0 0% 89.8%)',
    ring: 'hsl(0 0% 63%)',
    radius: '0.625rem',
    chart1: 'hsl(12 76% 61%)',
    chart2: 'hsl(173 58% 39%)',
    chart3: 'hsl(197 37% 24%)',
    chart4: 'hsl(43 74% 66%)',
    chart5: 'hsl(27 87% 67%)',
    // Finance semantics
    gain: 'hsl(142 72% 38%)',
    loss: 'hsl(0 74% 50%)',
    flat: 'hsl(0 0% 45%)',
    // Session colours match Fibenchi's market-status-dot: pre = blue, post = orange.
    marketPre: 'hsl(217 91% 60%)',
    marketRegular: 'hsl(142 72% 40%)',
    marketPost: 'hsl(25 95% 53%)',
    marketClosed: 'hsl(0 0% 45%)',
  },
  dark: {
    background: 'hsl(0 0% 3.9%)',
    foreground: 'hsl(0 0% 98%)',
    card: 'hsl(0 0% 3.9%)',
    cardForeground: 'hsl(0 0% 98%)',
    popover: 'hsl(0 0% 3.9%)',
    popoverForeground: 'hsl(0 0% 98%)',
    primary: 'hsl(0 0% 98%)',
    primaryForeground: 'hsl(0 0% 9%)',
    secondary: 'hsl(0 0% 14.9%)',
    secondaryForeground: 'hsl(0 0% 98%)',
    muted: 'hsl(0 0% 14.9%)',
    mutedForeground: 'hsl(0 0% 63.9%)',
    accent: 'hsl(0 0% 14.9%)',
    accentForeground: 'hsl(0 0% 98%)',
    destructive: 'hsl(0 70.9% 59.4%)',
    border: 'hsl(0 0% 14.9%)',
    input: 'hsl(0 0% 14.9%)',
    ring: 'hsl(300 0% 45%)',
    radius: '0.625rem',
    chart1: 'hsl(220 70% 50%)',
    chart2: 'hsl(160 60% 45%)',
    chart3: 'hsl(30 80% 55%)',
    chart4: 'hsl(280 65% 60%)',
    chart5: 'hsl(340 75% 55%)',
    // Finance semantics
    gain: 'hsl(142 70% 45%)',
    loss: 'hsl(0 72% 58%)',
    flat: 'hsl(0 0% 64%)',
    marketPre: 'hsl(217 91% 65%)',
    marketRegular: 'hsl(142 70% 45%)',
    marketPost: 'hsl(25 95% 58%)',
    marketClosed: 'hsl(0 0% 55%)',
  },
};

/** The colour palette for one scheme — the shape every consumer reads. */
export type ThemePalette = (typeof THEME)['dark'];

/**
 * The active palette, dark-first: falls back to dark when the system scheme is
 * unset (matching the root layout). Replaces the `THEME[colorScheme ?? 'dark']`
 * line that was repeated in every themed component.
 */
export function useTheme(): ThemePalette {
  const { colorScheme } = useColorScheme();
  return THEME[colorScheme ?? 'dark'];
}

/**
 * Make a theme colour safe to hand to Skia (and thus victory-native).
 *
 * Skia bundles the old deanm CSS colour parser, which only accepts *comma*-
 * separated `hsl(h, s%, l%)`. Our theme (like Tailwind/shadcn) uses the modern
 * *space*-separated `hsl(h s% l%)`, which React Native core and react-native-svg
 * parse fine — but Skia does not: it silently falls back to **black**. Rewrite
 * space-separated `hsl()`/`hsla()` into the comma form Skia understands; pass
 * anything else (hex, rgb, already-comma, named) through untouched.
 */
export function skiaColor(color: string): string {
  // Hex / named have no spaces; rgb()/comma-hsl already have commas → leave them.
  if (!color.includes(' ') || color.includes(',')) return color;
  const match = /^hsla?\(([^)]+)\)$/i.exec(color.trim());
  if (!match) return color;
  // "142 70% 45%" or "142 70% 45% / 0.5" → ["142","70%","45%"(,"0.5")]
  const parts = match[1].replace('/', ' ').split(/\s+/).filter(Boolean);
  if (parts.length < 3) return color;
  const [h, s, l, a] = parts;
  return a != null ? `hsla(${h}, ${s}, ${l}, ${a})` : `hsl(${h}, ${s}, ${l})`;
}

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
