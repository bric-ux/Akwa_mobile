import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export const SearchButton: React.FC<SearchButtonProps> = ({
  onPress,
  disabled = false,
  loading = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <>
            <Ionicons name="refresh" size={20} color="#fff" style={styles.loadingIcon} />
            <Text style={styles.buttonText}>Recherche...</Text>
          </>
        ) : (
          <>
            <Ionicons name="search" size={20} color="#fff" />
            <Text style={styles.buttonText}>Rechercher</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginHorizontal: 20,
    marginVertical: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingIcon: {
    transform: [{ rotate: '360deg' }],
  },
});

export default SearchButton;
