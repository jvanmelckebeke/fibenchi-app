# Fibenchi App — CLAUDE.md

Mobile companion for **Fibenchi** (self-hosted stock/ETF watchlist at
`fibenchi.wstation.lan`). Glanceable market data on the phone — price, sparkline,
RSI/MACD, movement, current-day trajectory. Not a full charting tool; that stays
on the laptop in Fibenchi proper.

## Architecture (and why)

Three planes, deliberately decoupled:

- **Data plane — direct to Yahoo.** This is a native React Native build, so it is
  NOT bound by browser CORS and calls Yahoo Finance directly
  (`v8/finance/chart/...`). No proxy, no AWS, no API key. A phone's
  residential/mobile IP is also less likely to be Yahoo-rate-limited than a
  datacenter would be. **This is the whole reason we went native instead of a
  PWA** — the earlier PWA design (an AWS Lambda Yahoo-proxy) in
  `../fibenchi/claudedocs/mobile-companion-pwa-design.md` is **obsolete; this file
  supersedes it.**
- **Compute plane — on device.** RSI / MACD / SMA / movement are computed in TS
  from OHLC. `movement-stats.ts` is ported ~verbatim from Fibenchi; `indicators.py`
  is ported to TS behind a data-driven registry (one struct per indicator).
- **Config plane — paired Fibenchi endpoint.** The app learns *what to track*
  (groups/tickers) from a Fibenchi endpoint entered on first launch, persisted
  locally, re-synced daily-if-reachable + on demand. That endpoint is the only
  coupling to Fibenchi — keep the contract explicit.

## Stack

Expo SDK 55 · React Native 0.83 · React 19 · expo-router (typed routes) ·
NativeWind 4 (Tailwind) · react-native-reusables (shadcn/ui for RN). Android-first;
builds via EAS (cloud) — see `eas.json`. Dark-first theme.

## Layout

- `app/` — expo-router screens
- `components/ui/` — react-native-reusables primitives (`npx @react-native-reusables/cli@latest add <name>`)
- `lib/market/` — Yahoo client + types (data plane)
- `lib/compute/` — indicators + movement (compute plane)
- `lib/config/` — endpoint pairing + sync (config plane)
- `lib/theme.ts` — colors incl. finance semantics
- `stores/` — per-symbol subscription stores (a quote tick re-renders one row, not the list)

## Conventions

Subset of Jari's coding standards that applies to a personal, daily-use TS app:

- **Strict TS** (`strict: true`), with `noUnusedLocals/Parameters: false` — strict
  on shape, lenient on cleanup.
- **Domain precision in identifiers** — `groups`, `tickers`, `movement`,
  `sparkline`, `pseudoETF`. Code talks the domain.
- **Data-driven registries over code paths** — adding an indicator is one registry
  entry, not a new branch.
- **Boundary validation** — Yahoo's unofficial JSON is messy; validate/parse at the
  fetch boundary (hand-rolled, no Zod), trust internal types after.
- **Small public surface** — `lib/market` exposes `getQuote`/`getIntraday`/`getDaily`;
  the crumb/cookie handshake stays internal.
- **Base classes/generics OK where they kill real boilerplate** (typed provider, store factory).
- **Personal-mode lean** — no per-env config files, no custom exception
  hierarchies. Tests come when the code earns them, not day one.

Finance color classes: `text-gain`/`bg-gain` (up), `text-loss` (down),
`text-flat` (unchanged), `text-market-{pre,regular,post,closed}`.

## Commands

- `npm run dev` — Expo dev server
- `npm run android` — run on a device/emulator
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` / `npm run format`
- `npx @react-native-reusables/cli@latest add <component>` — add a UI primitive
- Build APK: `npx eas-cli build -p android --profile preview`
  (needs a one-time `eas login` + `eas init` to set `extra.eas.projectId` in `app.json`)

## Work tracking

GitHub issues at `jvanmelckebeke/fibenchi-app` (epics labeled `epic`). This is
issue #1 (scaffold & foundations).
