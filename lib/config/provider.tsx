import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchConfig } from './fetch';
import type { CompanionConfig, DecodeResult } from './index';

interface ConfigState {
  config: CompanionConfig | null;
  loading: boolean;
  error: string | null;
  /** Currently selected group name (drives the overview). */
  activeGroup: string | null;
  setActiveGroup: (name: string) => void;
  reload: () => void;
}

const ConfigContext = createContext<ConfigState | null>(null);

/**
 * Loads the config bundle from the Fibenchi endpoint on mount and holds the
 * active-group selection. (Local persistence + onboarding land in #4.)
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CompanionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // State updates happen in the promise continuation, never synchronously in the
  // effect body (which would cascade renders).
  const apply = useCallback((result: DecodeResult) => {
    if (result.ok) {
      setConfig(result.config);
      setActiveGroup((current) => current ?? result.config.groups?.[0]?.name ?? null);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchConfig().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const reload = useCallback(() => {
    setLoading(true);
    fetchConfig().then(apply);
  }, [apply]);

  return (
    <ConfigContext.Provider value={{ config, loading, error, activeGroup, setActiveGroup, reload }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigState {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within a ConfigProvider');
  return ctx;
}
