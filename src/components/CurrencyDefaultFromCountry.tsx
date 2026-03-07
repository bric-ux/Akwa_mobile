import React, { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../services/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';

// Codes pays Afrique (ISO 3166-1 alpha-2) pour devise par défaut CFA
const AFRICA_COUNTRY_CODES = new Set([
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET',
  'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW',
  'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW',
]);

const CurrencyDefaultFromCountry: React.FC = () => {
  const { user } = useAuth();
  const { changeCurrency, loading: currencyLoading } = useCurrency();
  const didInit = useRef(false);

  useEffect(() => {
    if (currencyLoading || didInit.current) return;
    (async () => {
      const saved = await AsyncStorage.getItem('selectedCurrency');
      if (saved) {
        didInit.current = true;
        return;
      }
      // Appliquer la devise par défaut selon le pays seulement si l'utilisateur est connecté
      if (!user) return;
      const country = (user.user_metadata as any)?.country_code || (user.user_metadata as any)?.country;
      const code = typeof country === 'string' ? country.trim().toUpperCase().slice(0, 2) : '';
      const isAfrica = code && AFRICA_COUNTRY_CODES.has(code);
      await changeCurrency(isAfrica ? 'XOF' : (code ? 'EUR' : 'XOF'));
      didInit.current = true;
    })();
  }, [user, currencyLoading, changeCurrency]);

  return null;
};

export default CurrencyDefaultFromCountry;
