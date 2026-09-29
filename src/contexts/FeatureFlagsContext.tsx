import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  setFlag: (key: FeatureFlagKey, enabled: boolean) => Promise<void>;
  monthlyRental: boolean;
  hotel: boolean;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

const CACHE_KEY = 'akwa.featureFlags.v1';

type FlagsCache = {
  userId: string | null;
  isAdminViewer: boolean;
  rawFlags: FeatureFlagsState;
  savedAt: number;
};

async function readCache(): Promise<FlagsCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlagsCache;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(cache: FlagsCache): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

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
  const { user, loading: authLoading } = useAuth();
  const [rawFlags, setRawFlags] = useState<FeatureFlagsState>({ ...FEATURE_FLAG_DEFAULTS });
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  /** true tant que auth ou 1er fetch flags pas prêts — évite de masquer hôtel/bail longue durée au reload */
  const [loading, setLoading] = useState(true);
  const cacheHydratedRef = useRef(false);
  const lastUserIdRef = useRef<string | null | undefined>(undefined);

  // Hydratation cache au boot : un admin qui recharge voit tout de suite hôtel / bail longue durée
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cache = await readCache();
      if (cancelled || !cache) {
        cacheHydratedRef.current = true;
        return;
      }
      setRawFlags({ ...FEATURE_FLAG_DEFAULTS, ...cache.rawFlags });
      setIsAdminViewer(!!cache.isAdminViewer);
      cacheHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      // Attendre la session : sinon on force isAdmin=false et les rayons disparaissent
      if (authLoading) return;

      const silent = opts?.silent === true || cacheHydratedRef.current;
      if (!silent) setLoading(true);

      const userId = user?.id ?? null;
      const [fromDb, admin] = await Promise.all([
        fetchFlagsFromDb(),
        resolveIsAdmin(userId ?? undefined),
      ]);

      // Si l’utilisateur a changé pendant l’await, ignorer ce résultat
      if ((user?.id ?? null) !== userId) return;

      setRawFlags(fromDb);
      setIsAdminViewer(admin);
      setLoading(false);
      void writeCache({
        userId,
        isAdminViewer: admin,
        rawFlags: fromDb,
        savedAt: Date.now(),
      });
    },
    [user?.id, authLoading],
  );

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    // Changement de compte → invalidation visuelle sauf si cache même user
    const uid = user?.id ?? null;
    if (lastUserIdRef.current !== undefined && lastUserIdRef.current !== uid) {
      // Nouveau guest / autre user : ne pas garder le cache admin d’un autre compte
      void readCache().then((cache) => {
        if (cache?.userId && cache.userId !== uid) {
          setIsAdminViewer(false);
          setRawFlags({ ...FEATURE_FLAG_DEFAULTS });
        }
      });
    }
    lastUserIdRef.current = uid;
    void refresh({ silent: true });
  }, [refresh, authLoading, user?.id]);

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
    setRawFlags((prev) => {
      const next = { ...prev, [key]: enabled };
      void writeCache({
        userId: auth.user?.id ?? null,
        isAdminViewer: true, // seul un admin peut setFlag
        rawFlags: next,
        savedAt: Date.now(),
      });
      return next;
    });
  }, []);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      loading: loading || authLoading,
      isAdminViewer,
      refresh,
      setFlag,
      monthlyRental: flags.monthly_rental,
      hotel: flags.hotel,
    }),
    [flags, loading, authLoading, isAdminViewer, refresh, setFlag],
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
