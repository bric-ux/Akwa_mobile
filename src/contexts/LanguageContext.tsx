import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

export type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string>) => string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Fichiers de traduction
import { translations } from '../locales/translations';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('fr');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const getSystemLanguage = (): Language => {
    try {
      const locales: any = (Localization as any)?.getLocales
        ? (Localization as any).getLocales()
        : null;

      if (Array.isArray(locales) && locales.length > 0) {
        const languageCode = locales[0]?.languageCode;
        if (languageCode && languageCode.toLowerCase() === 'en') {
          return 'en';
        }
      }

      const locale = (Localization as any)?.locale;
      if (typeof locale === 'string' && locale.includes('-')) {
        const systemLang = locale.split('-')[0]?.toLowerCase();
        if (systemLang === 'en') {
          return 'en';
        }
      } else if (typeof locale === 'string') {
        const systemLang = locale.toLowerCase();
        if (systemLang === 'en') {
          return 'en';
        }
      }
    } catch (error) {
      console.warn('Impossible de récupérer la langue système, utilisation du français par défaut.', error);
    }
    return 'fr';
  };

  const loadSavedLanguage = async () => {
    try {
      setLoading(true);
      const saved = await AsyncStorage.getItem('selectedLanguage');
      if (saved && (saved === 'fr' || saved === 'en')) {
        setLanguageState(saved as Language);
      } else {
        // Utiliser la langue du système si disponible
        const defaultLang = getSystemLanguage();
        setLanguageState(defaultLang);
        await AsyncStorage.setItem('selectedLanguage', defaultLang);
      }
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement langue:', error);
      setLoading(false);
    }
  };

  const setLanguage = async (newLanguage: Language) => {
    try {
      console.log('🌐 Changement de langue:', newLanguage);
      setLanguageState(newLanguage);
      await AsyncStorage.setItem('selectedLanguage', newLanguage);
      console.log('🌐 Langue sauvegardée:', newLanguage);
    } catch (error) {
      console.error('Erreur changement langue:', error);
    }
  };

  const t = (key: string, params?: Record<string, string>): string => {
    let text = translations[language]?.[key] || translations['fr'][key] || key;
    
    // Support pour l'interpolation de paramètres {{param}}
    if (params) {
      Object.keys(params).forEach(param => {
        const regex = new RegExp(`\\{\\{${param}\\}\\}`, 'g');
        text = text.replace(regex, params[param]);
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

