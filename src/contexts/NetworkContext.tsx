import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/** Délai avant d'afficher « hors ligne » (évite les flashs lors des changements réseau). */
const OFFLINE_BANNER_DELAY_MS = 2500;

type NetworkContextValue = {
  isOffline: boolean;
  refreshNetwork: () => Promise<boolean>;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOffline: false,
  refreshNetwork: async () => true,
});

/**
 * NetInfo signale souvent isInternetReachable=false à tort (Wi‑Fi OK, check lent, réseau local…).
 * On ne considère hors ligne que lorsque la liaison réseau est réellement coupée.
 */
function isDefinitelyOffline(state: NetInfoState | null): boolean {
  if (!state) return false;
  return state.isConnected === false;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOfflineTimer = useCallback(() => {
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
  }, []);

  const applyState = useCallback(
    (state: NetInfoState | null) => {
      const offline = isDefinitelyOffline(state);

      if (!offline) {
        clearOfflineTimer();
        setIsOffline(false);
        return;
      }

      if (offlineTimerRef.current) return;

      offlineTimerRef.current = setTimeout(() => {
        offlineTimerRef.current = null;
        setIsOffline(true);
      }, OFFLINE_BANNER_DELAY_MS);
    },
    [clearOfflineTimer],
  );

  const refreshNetwork = useCallback(async () => {
    const state = await NetInfo.fetch();
    applyState(state);
    return !isDefinitelyOffline(state);
  }, [applyState]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(applyState);
    NetInfo.fetch().then(applyState);
    return () => {
      unsubscribe();
      clearOfflineTimer();
    };
  }, [applyState, clearOfflineTimer]);

  return (
    <NetworkContext.Provider value={{ isOffline, refreshNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
