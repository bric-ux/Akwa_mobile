import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import LocationSearchInput from './LocationSearchInput';
import { LocationResult } from '../hooks/useLocationSearch';

const LocationTestComponent: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [lastSelected, setLastSelected] = useState<LocationResult | null>(null);

  const handleLocationSelect = (location: LocationResult) => {
    console.log('🎯 Test - Localisation sélectionnée:', location);
    setLastSelected(location);
    
    // Afficher une alerte pour confirmer la sélection
    Alert.alert(
      'Localisation sélectionnée !',
      `Vous avez sélectionné : ${location.name}\nType : ${location.type}\nRégion : ${location.region || location.commune || 'N/A'}`,
      [{ text: 'OK' }]
    );
  };

  const handleTextChange = (text: string) => {
    console.log('📝 Test - Texte changé:', text);
    setSelectedLocation(text);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test de sélection de localisation</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Localisation sélectionnée :</Text>
        <Text style={styles.value}>{selectedLocation || 'Aucune'}</Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Dernière sélection :</Text>
        <Text style={styles.value}>
          {lastSelected ? `${lastSelected.name} (${lastSelected.type})` : 'Aucune'}
        </Text>
      </View>

      <LocationSearchInput
        value={selectedLocation}
        onChangeText={handleTextChange}
        onLocationSelect={handleLocationSelect}
        placeholder="Testez la sélection de localisation..."
        style={styles.locationInput}
      />

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Instructions de test :
        </Text>
        <Text style={styles.instructionText}>
          1. Tapez dans le champ de recherche
        </Text>
        <Text style={styles.instructionText}>
          2. Cliquez sur une suggestion
        </Text>
        <Text style={styles.instructionText}>
          3. Vérifiez que la valeur reste dans le champ
        </Text>
        <Text style={styles.instructionText}>
          4. Une alerte doit confirmer la sélection
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  locationInput: {
    marginBottom: 20,
  },
  instructions: {
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  instructionText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 5,
  },
});

export default LocationTestComponent;

