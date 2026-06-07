import { createMMKV } from 'react-native-mmkv';

// Synchronous local persistence (MMKV v4 / Nitro). Lets a cold start paint the
// last-known config instantly — including offline / when the endpoint is
// unreachable.
const mmkv = createMMKV({ id: 'fibenchi' });

const KEY_ENDPOINT = 'endpoint';
const KEY_CONFIG = 'config';
const KEY_LAST_SYNCED = 'lastSyncedAt';

export const storage = {
  getEndpoint: (): string | undefined => mmkv.getString(KEY_ENDPOINT),
  setEndpoint: (value: string): void => mmkv.set(KEY_ENDPOINT, value),

  /** Raw cached config bundle (re-validated on read by the caller). */
  getConfigRaw: (): unknown => {
    const serialized = mmkv.getString(KEY_CONFIG);
    return serialized ? JSON.parse(serialized) : null;
  },
  setConfigRaw: (value: unknown): void => mmkv.set(KEY_CONFIG, JSON.stringify(value)),

  getLastSyncedAt: (): number | undefined => mmkv.getNumber(KEY_LAST_SYNCED),
  setLastSyncedAt: (value: number): void => mmkv.set(KEY_LAST_SYNCED, value),
};
