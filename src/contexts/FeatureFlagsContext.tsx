import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import {
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_KEYS,
  applyExperimentalProductGate,
  type FeatureFlagKey,
} from '../constants/features';

export type FeatureFlagsState = Record<FeatureFlagKey, boolean>;

type FeatureFlagsContextValue = {
  flags: FeatureFlagsState;
  loading: boolean;
  isAdminViewer: boolean;
  refresh: () => Promise<void>;
  setFlag: (key: FeatureFlagKey, enabled: boolean) => Promise<void>;
  monthlyRental: boolean;
  hotel: boolean;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

async function fetchFlagsFromDb(): Promise<FeatureFlagsState> {
  const next: FeatureFlagsState = { ...FEATURE_FLAG_DEFAULTS };
  try {
    const { data, error } = await supabase
      .from('platform_feature_flags')
      .select('key, enabled')
      .in('key', Object.values(FEATURE_FLAG_KEYS));

    if (error) {
      console.warn('[featureFlags] lecture:', error.message);
      return next;
    }

    for (const row of data ?? []) {
      if (row.key in next) {
        next[row.key as FeatureFlagKey] = !!row.enabled;
      }
    }
  } catch (e) {
    console.warn('[featureFlags] exception:', e);
  }
  return next;
}

async function resolveIsAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.role === 'admin';
  } catch {
    return false;
  }
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [rawFlags, setRawFlags] = useState<FeatureFlagsState>({ ...FEATURE_FLAG_DEFAULTS });
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [fromDb, admin] = await Promise.all([
      fetchFlagsFromDb(),
      resolveIsAdmin(user?.id),
    ]);
    setRawFlags(fromDb);
    setIsAdminViewer(admin);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flags = useMemo(
    () => applyExperimentalProductGate(rawFlags, isAdminViewer),
    [rawFlags, isAdminViewer],
  );

  const setFlag = useCallback(async (key: FeatureFlagKey, enabled: boolean) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('platform_feature_flags').upsert({
      key,
      enabled,
      updated_at: new Date().toISOString(),
      updated_by: auth.user?.id ?? null,
    });
    if (error) throw error;
    setRawFlags((prev) => ({ ...prev, [key]: enabled }));
  }, []);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      loading,
      isAdminViewer,
      refresh,
      setFlag,
      monthlyRental: flags.monthly_rental,
      hotel: flags.hotel,
    }),
    [flags, loading, isAdminViewer, refresh, setFlag],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) {
    const gated = applyExperimentalProductGate({ ...FEATURE_FLAG_DEFAULTS }, false);
    return {
      flags: gated,
      loading: false,
      isAdminViewer: false,
      refresh: async () => undefined,
      setFlag: async () => undefined,
      monthlyRental: false,
      hotel: false,
    };
  }
  return ctx;
}
