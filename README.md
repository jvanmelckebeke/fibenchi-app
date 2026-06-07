# Fibenchi App

Mobile (React Native / Expo) companion for
[Fibenchi](https://github.com/jvanmelckebeke/fibenchi) — glanceable market data on
the go.

- Fetches market data **directly from Yahoo Finance** on-device (no proxy/server).
- Computes RSI / MACD / movement **on-device**.
- Syncs your watchlist (groups/tickers) from a Fibenchi endpoint.

Android-first native app, dark-first.

## Stack

Expo SDK 55 · React Native · expo-router · NativeWind ·
[react-native-reusables](https://reactnativereusables.com).

## Develop

```bash
npm install
npm run dev        # Expo dev server
npm run android    # run on a device/emulator
npm run typecheck  # tsc --noEmit
npm run lint
```

Add a UI primitive: `npx @react-native-reusables/cli@latest add <component>`.

See [`CLAUDE.md`](./CLAUDE.md) for architecture and conventions.

## License

[Apache-2.0](./LICENSE).
