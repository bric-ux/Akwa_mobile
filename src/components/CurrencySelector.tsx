import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency, Currency } from '../hooks/useCurrency';

const CurrencySelector: React.FC = () => {
  const { currency, changeCurrency, CURRENCY_NAMES, CURRENCY_SYMBOLS } = useCurrency();

  const currencies: Currency[] = ['XOF', 'EUR', 'USD'];

  const handleSelect = (newCurrency: Currency) => {
    changeCurrency(newCurrency);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sélectionner la devise</Text>
      <Text style={styles.subtitle}>Choisissez votre devise de préférence</Text>
      
      <ScrollView style={styles.currenciesList}>
        {currencies.map((curr) => (
          <TouchableOpacity
            key={curr}
            style={[styles.currencyItem, currency === curr && styles.currencyItemActive]}
            onPress={() => handleSelect(curr)}
            activeOpacity={0.7}
          >
            <View style={styles.currencyInfo}>
              <View style={styles.currencyLeft}>
                <Text style={styles.currencySymbol}>{CURRENCY_SYMBOLS[curr]}</Text>
                <View style={styles.currencyTextContainer}>
                  <Text style={[styles.currencyCode, currency === curr && styles.currencyCodeActive]}>
                    {curr === 'XOF' ? 'CFA' : curr}
                  </Text>
                  <Text style={[styles.currencyName, currency === curr && styles.currencyNameActive]}>
                    {CURRENCY_NAMES[curr]}
                  </Text>
                </View>
              </View>
              
              {currency === curr && (
                <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {currency !== 'XOF' && (
        <View style={styles.noteContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.noteText}>
            Les prix sont convertis depuis le Franc CFA (CFA). Les taux de change peuvent varier.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  currenciesList: {
    flex: 1,
  },
  currencyItem: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  currencyItemActive: {
    borderColor: '#2E7D32',
    backgroundColor: '#f0f8f0',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  currencyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
    width: 40,
  },
  currencyTextContainer: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  currencyCodeActive: {
    color: '#2E7D32',
  },
  currencyName: {
    fontSize: 14,
    color: '#999',
  },
  currencyNameActive: {
    color: '#666',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  noteText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});

export default CurrencySelector;

