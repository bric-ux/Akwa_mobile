import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../services/AuthContext';

const SEARCH_DATES_KEY = 'search_dates';

interface SearchDates {
  checkIn?: string;
  checkOut?: string;
  checkInDateTime?: string; // Date avec heure (ISO string)
  checkOutDateTime?: string; // Date avec heure (ISO string)
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
  const { user } = useAuth();

  const loadDates = useCallback(async () => {
    try {
      console.log('📅 SearchDatesContext - Tentative de chargement depuis AsyncStorage...');
      const saved = await AsyncStorage.getItem(SEARCH_DATES_KEY);
      console.log('📅 SearchDatesContext - Données brutes récupérées:', saved);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Vérifier que les dates chargées sont valides et non vides
        const hasValidDates = (parsed.checkIn && parsed.checkIn.trim() !== '') || 
                              (parsed.checkOut && parsed.checkOut.trim() !== '');
        if (hasValidDates) {
          setDatesState(parsed);
          console.log('✅ SearchDatesContext - Dates chargées depuis AsyncStorage:', parsed);
        } else {
          // Si les dates sont vides, les supprimer
          await AsyncStorage.removeItem(SEARCH_DATES_KEY);
          setDatesState({});
          console.log('⚠️ SearchDatesContext - Dates vides trouvées, suppression de AsyncStorage');
        }
      } else {
        console.log('⚠️ SearchDatesContext - Aucune date trouvée dans AsyncStorage');
        setDatesState({});
      }
    } catch (error) {
      console.error('❌ Erreur chargement dates:', error);
      setDatesState({});
    }
  }, []);

  const setDates = useCallback(async (newDates: SearchDates) => {
    try {
      console.log('📅 SearchDatesContext - setDates appelé avec:', newDates);
      
      // Filtrer les dates vides avant de sauvegarder
      const filteredDates: SearchDates = {};
      if (newDates.checkIn && newDates.checkIn.trim() !== '') {
        filteredDates.checkIn = newDates.checkIn;
      }
      if (newDates.checkOut && newDates.checkOut.trim() !== '') {
        filteredDates.checkOut = newDates.checkOut;
      }
      if (newDates.checkInDateTime && newDates.checkInDateTime.trim() !== '') {
        filteredDates.checkInDateTime = newDates.checkInDateTime;
        console.log('📅 SearchDatesContext - checkInDateTime sauvegardé:', newDates.checkInDateTime);
      }
      if (newDates.checkOutDateTime && newDates.checkOutDateTime.trim() !== '') {
        filteredDates.checkOutDateTime = newDates.checkOutDateTime;
        console.log('📅 SearchDatesContext - checkOutDateTime sauvegardé:', newDates.checkOutDateTime);
      }
      if (newDates.adults !== undefined) {
        filteredDates.adults = newDates.adults;
      }
      if (newDates.children !== undefined) {
        filteredDates.children = newDates.children;
      }
      if (newDates.babies !== undefined) {
        filteredDates.babies = newDates.babies;
      }
      
      setDatesState(filteredDates);
      
      // Ne sauvegarder que si au moins une date est définie
      if (filteredDates.checkIn || filteredDates.checkOut || filteredDates.checkInDateTime || filteredDates.checkOutDateTime) {
        const jsonString = JSON.stringify(filteredDates);
        await AsyncStorage.setItem(SEARCH_DATES_KEY, jsonString);
        console.log('✅ SearchDatesContext - Dates sauvegardées dans AsyncStorage:', filteredDates);
      } else {
        // Si aucune date n'est définie, supprimer de AsyncStorage
        await AsyncStorage.removeItem(SEARCH_DATES_KEY);
        console.log('📅 SearchDatesContext - Dates vides, suppression de AsyncStorage');
      }
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

  // Charger les dates au démarrage seulement si l'utilisateur est connecté
  useEffect(() => {
    if (user) {
      loadDates();
    } else {
      // Si pas d'utilisateur, effacer les dates
      clearDates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effacer les dates lors de la déconnexion
  useEffect(() => {
    if (!user) {
      // Utilisateur déconnecté, effacer les dates
      clearDates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

