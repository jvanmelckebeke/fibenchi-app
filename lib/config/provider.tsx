import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { storage } from '@/lib/storage';

import { DEFAULT_ENDPOINT } from './constants';
import { fetchConfig } from './fetch';
import { safeDecodeConfig, type CompanionConfig } from './index';

const STALE_MS = 24 * 60 * 60 * 1000; // 1 day

type SyncStatus = 'idle' | 'syncing' | 'error';

interface ConfigState {
  config: CompanionConfig | null;
  /** Resolved endpoint (stored override, else build-time default). Null → onboarding. */
  endpoint: string | null;
  needsOnboarding: boolean;
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: number | null;
  activeGroup: string | null;
  setActiveGroup: (name: string) => void;
  /** Force a sync now (manual). */
  sync: () => void;
  /** Set/replace the endpoint (onboarding/settings); validates by fetching. */
  setEndpoint: (url: string) => Promise<{ ok: boolean; error?: string }>;
}

const ConfigContext = createContext<ConfigState | null>(null);

/** Last-known config from disk, re-validated (a contract bump invalidates it). */
function loadCachedConfig(): CompanionConfig | null {
  const raw = storage.getConfigRaw();
  if (!raw) return null;
  const result = safeDecodeConfig(raw);
  return result.ok ? result.config : null;
}

function resolveInitialEndpoint(): string | null {
  return storage.getEndpoint() ?? (DEFAULT_ENDPOINT || null);
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CompanionConfig | null>(loadCachedConfig);
  const [endpoint, setEndpointState] = useState<string | null>(resolveInitialEndpoint);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => storage.getLastSyncedAt() ?? null);
  const [activeGroup, setActiveGroup] = useState<string | null>(() => config?.groups?.[0]?.name ?? null);

  const runSync = useCallback((url: string) => {
    setStatus('syncing');
    fetchConfig(url).then((result) => {
      if (result.ok) {
        setConfig(result.config);
        setActiveGroup((current) => current ?? result.config.groups?.[0]?.name ?? null);
        storage.setConfigRaw(result.config);
        const ts = Date.now();
        storage.setLastSyncedAt(ts);
        setLastSyncedAt(ts);
        setError(null);
        setStatus('idle');
      } else {
        // Keep the existing (cached) config — offline-friendly.
        setError(result.error);
        setStatus('error');
      }
    });
  }, []);

  const sync = useCallback(() => {
    if (endpoint) runSync(endpoint);
  }, [endpoint, runSync]);

  // Initial / endpoint-change sync — only when there's no cache or it's stale
  // (>1 day). Deferred a tick so we don't setState synchronously in the effect.
  useEffect(() => {
    if (!endpoint) return;
    const stale = !lastSyncedAt || Date.now() - lastSyncedAt > STALE_MS;
    if (config && !stale) return;
    const timer = setTimeout(() => runSync(endpoint), 0);
    return () => clearTimeout(timer);
  }, [endpoint, lastSyncedAt, config, runSync]);

  // Re-check staleness when the app returns to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !endpoint) return;
      const stale = !lastSyncedAt || Date.now() - lastSyncedAt > STALE_MS;
      if (stale) runSync(endpoint);
    });
    return () => subscription.remove();
  }, [endpoint, lastSyncedAt, runSync]);

  const setEndpoint = useCallback(async (url: string) => {
    const clean = url.trim().replace(/\/+$/, '');
    const result = await fetchConfig(clean);
    if (!result.ok) return { ok: false, error: result.error };
    storage.setEndpoint(clean);
    storage.setConfigRaw(result.config);
    const ts = Date.now();
    storage.setLastSyncedAt(ts);
    setEndpointState(clean);
    setConfig(result.config);
    setActiveGroup((current) => current ?? result.config.groups?.[0]?.name ?? null);
    setLastSyncedAt(ts);
    setError(null);
    setStatus('idle');
    return { ok: true };
  }, []);

  return (
    <ConfigContext.Provider
      value={{
        config,
        endpoint,
        needsOnboarding: endpoint === null,
        status,
        error,
        lastSyncedAt,
        activeGroup,
        setActiveGroup,
        sync,
        setEndpoint,
      }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigState {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within a ConfigProvider');
  return ctx;
}
