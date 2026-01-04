import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_DATES_KEY = 'search_dates';

interface SearchDates {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  babies?: number;
}

interface SearchDatesContextType {
  dates: SearchDates;
  setDates: (dates: SearchDates) => Promise<void>;
  clearDates: () => Promise<void>;
}

const SearchDatesContext = createContext<SearchDatesContextType | undefined>(undefined);

export const SearchDatesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dates, setDatesState] = useState<SearchDates>({});

  const loadDates = useCallback(async () => {
    try {
      console.log('📅 SearchDatesContext - Tentative de chargement depuis AsyncStorage...');
      const saved = await AsyncStorage.getItem(SEARCH_DATES_KEY);
      console.log('📅 SearchDatesContext - Données brutes récupérées:', saved);
      if (saved) {
        const parsed = JSON.parse(saved);
        setDatesState(parsed);
        console.log('✅ SearchDatesContext - Dates chargées depuis AsyncStorage:', parsed);
      } else {
        console.log('⚠️ SearchDatesContext - Aucune date trouvée dans AsyncStorage');
      }
    } catch (error) {
      console.error('❌ Erreur chargement dates:', error);
    }
  }, []);

  const setDates = useCallback(async (newDates: SearchDates) => {
    try {
      console.log('📅 SearchDatesContext - setDates appelé avec:', newDates);
      setDatesState(newDates);
      const jsonString = JSON.stringify(newDates);
      await AsyncStorage.setItem(SEARCH_DATES_KEY, jsonString);
      console.log('✅ SearchDatesContext - Dates sauvegardées dans AsyncStorage:', newDates);
      
      // Vérifier que c'est bien sauvegardé
      const verify = await AsyncStorage.getItem(SEARCH_DATES_KEY);
      console.log('✅ SearchDatesContext - Vérification sauvegarde:', verify);
    } catch (error) {
      console.error('❌ Erreur sauvegarde dates:', error);
    }
  }, []);

  const clearDates = useCallback(async () => {
    try {
      setDatesState({});
      await AsyncStorage.removeItem(SEARCH_DATES_KEY);
      console.log('📅 Dates supprimées');
    } catch (error) {
      console.error('Erreur suppression dates:', error);
    }
  }, []);

  // Charger les dates au démarrage (une seule fois)
  useEffect(() => {
    loadDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mémoriser la valeur du context pour éviter les re-renders inutiles
  const contextValue = useMemo(() => ({
    dates,
    setDates,
    clearDates,
  }), [dates, setDates, clearDates]);

  return (
    <SearchDatesContext.Provider value={contextValue}>
      {children}
    </SearchDatesContext.Provider>
  );
};

export const useSearchDatesContext = () => {
  const context = useContext(SearchDatesContext);
  if (!context) {
    throw new Error('useSearchDatesContext must be used within SearchDatesProvider');
  }
  return context;
};

