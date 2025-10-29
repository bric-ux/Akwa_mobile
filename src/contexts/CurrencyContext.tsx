import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Currency = 'XOF' | 'EUR' | 'USD' | 'RUB' | 'JPY';

interface ExchangeRates {
  [key: string]: number;
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  XOF: 'CFA',
  EUR: '€',
  USD: '$',
  RUB: '₽',
  JPY: '¥',
};

const CURRENCY_NAMES: Record<Currency, string> = {
  XOF: 'Franc CFA',
  EUR: 'Euro',
  USD: 'Dollar US',
  RUB: 'Rouble',
  JPY: 'Yen',
};

const DEFAULT_RATES: ExchangeRates = {
  EUR: 655.957,
  USD: 600.000,
  RUB: 6.500,
  JPY: 4.000,
  XOF: 1,
};

interface CurrencyContextType {
  currency: Currency;
  currencySymbol: string;
  currencyName: string;
  changeCurrency: (newCurrency: Currency) => Promise<void>;
  convert: (amountXOF: number) => { converted: number; formatted: string };
  formatPrice: (amountXOF: number, showOriginal?: boolean) => string;
  rates: ExchangeRates;
  loading: boolean;
  CURRENCY_NAMES: Record<Currency, string>;
  CURRENCY_SYMBOLS: Record<Currency, string>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<Currency>('XOF');
  const [rates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedCurrency();
  }, []);

  const loadSavedCurrency = async () => {
    try {
      setLoading(true);
      const saved = await AsyncStorage.getItem('selectedCurrency');
      if (saved) {
        setCurrency(saved as Currency);
        console.log('💰 Devise chargée depuis le stockage:', saved);
      }
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement devise:', error);
      setLoading(false);
    }
  };

  const changeCurrency = async (newCurrency: Currency) => {
    try {
      console.log('💰 Changement de devise:', newCurrency);
      setCurrency(newCurrency);
      await AsyncStorage.setItem('selectedCurrency', newCurrency);
      console.log('💰 Devise sauvegardée:', newCurrency);
    } catch (error) {
      console.error('Erreur changement devise:', error);
    }
  };

  const convert = (amountXOF: number): { converted: number; formatted: string } => {
    if (!amountXOF || amountXOF === 0) {
      return { converted: 0, formatted: `0 ${CURRENCY_SYMBOLS[currency]}` };
    }

    const rate = rates[currency];
    const converted = currency === 'XOF' ? amountXOF : amountXOF / rate;

    let formatted: string;
    
    if (currency === 'XOF') {
      formatted = `${Math.round(converted).toLocaleString('fr-FR')} FCFA`;
    } else if (currency === 'JPY') {
      formatted = `¥${Math.round(converted).toLocaleString('fr-FR')}`;
    } else {
      // EUR, USD, RUB: 2 décimales, format fr-FR
      const withTwoDecimals = Number(converted).toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      formatted = `${CURRENCY_SYMBOLS[currency]}${withTwoDecimals}`;
    }

    return { converted, formatted };
  };

  const formatPrice = (amountXOF: number, showOriginal: boolean = true): string => {
    const { formatted } = convert(amountXOF);
    
    if (currency === 'XOF' || !showOriginal) {
      return formatted;
    }

    const originalPrice = `${Math.round(amountXOF).toLocaleString('fr-FR')} FCFA`;
    return `${formatted} (${originalPrice})`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencySymbol: CURRENCY_SYMBOLS[currency],
        currencyName: CURRENCY_NAMES[currency],
        changeCurrency,
        convert,
        formatPrice,
        rates,
        loading,
        CURRENCY_NAMES,
        CURRENCY_SYMBOLS,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

