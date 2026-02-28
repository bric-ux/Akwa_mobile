import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency, Currency } from '../hooks/useCurrency';

const CurrencyBadge: React.FC = () => {
  const { currency, changeCurrency, currencySymbol } = useCurrency();
  const [showModal, setShowModal] = useState(false);

  const currencies: Currency[] = ['XOF', 'EUR', 'USD'];

  const handleSelect = (newCurrency: Currency) => {
    changeCurrency(newCurrency);
    setShowModal(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.badge}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.badgeText}>{currencySymbol}</Text>
        <Ionicons name="chevron-down" size={12} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choisir la devise</Text>
            {currencies.map((curr) => (
              <TouchableOpacity
                key={curr}
                style={[
                  styles.currencyOption,
                  currency === curr && styles.currencyOptionActive
                ]}
                onPress={() => handleSelect(curr)}
              >
                <View style={styles.currencyLeft}>
                  <Ionicons
                    name="cash-outline"
                    size={20}
                    color={currency === curr ? '#e67e22' : '#666'}
                  />
                  <Text
                    style={[
                      styles.currencyText,
                      currency === curr && styles.currencyTextActive
                    ]}
                  >
                    {curr === 'XOF' ? 'CFA' : curr}
                  </Text>
                </View>
                {currency === curr && (
                  <Ionicons name="checkmark" size={20} color="#e67e22" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e67e22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '70%',
    minWidth: 200,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  currencyOptionActive: {
    backgroundColor: '#fff5ed',
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currencyText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  currencyTextActive: {
    color: '#e67e22',
    fontWeight: '600',
  },
});

export default CurrencyBadge;



