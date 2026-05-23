import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkContextValue = {
  isOffline: boolean;
  refreshNetwork: () => Promise<boolean>;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOffline: false,
  refreshNetwork: async () => true,
});

function computeOffline(state: NetInfoState | null): boolean {
  if (!state) return false;
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);

  const applyState = useCallback((state: NetInfoState | null) => {
    setIsOffline(computeOffline(state));
  }, []);

  const refreshNetwork = useCallback(async () => {
    const state = await NetInfo.fetch();
    applyState(state);
    return !computeOffline(state);
  }, [applyState]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(applyState);
    NetInfo.fetch().then(applyState);
    return unsubscribe;
  }, [applyState]);

  return (
    <NetworkContext.Provider value={{ isOffline, refreshNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
