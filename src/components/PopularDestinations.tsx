import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CityStats } from '../hooks/useCities';

interface PopularDestinationsProps {
  destinations: CityStats[];
  onDestinationPress?: (destination: CityStats) => void;
  loading?: boolean;
}

export const PopularDestinations: React.FC<PopularDestinationsProps> = ({
  destinations,
  onDestinationPress,
  loading = false,
}) => {

  const getCityColor = (cityName: string): string => {
    const colors = [
      '#2E7D32', // Vert
      '#1976D2', // Bleu
      '#D32F2F', // Rouge
      '#7B1FA2', // Violet
      '#F57C00', // Orange
      '#388E3C', // Vert foncé
      '#5D4037', // Marron
      '#455A64', // Gris bleu
    ];
    
    const index = cityName.length % colors.length;
    return colors[index];
  };

  const renderDestinationCard = (destination: CityStats) => {
    return (
    <TouchableOpacity
      key={destination.id}
      style={styles.destinationCard}
      onPress={() => onDestinationPress?.(destination)}
    >
      <View style={[styles.fallbackImage, { backgroundColor: getCityColor(destination.name) }]}>
        <Text style={styles.fallbackText}>{destination.name.charAt(0)}</Text>
      </View>
      
      <View style={styles.destinationOverlay}>
        <Text style={styles.destinationName}>{destination.name}</Text>
        <Text style={styles.propertiesCount}>
          {destination.propertiesCount} propriétés
        </Text>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Destinations populaires</Text>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement des destinations...</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {destinations.map(renderDestinationCard)}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  destinationCard: {
    width: 200,
    height: 120,
    borderRadius: 12,
    marginRight: 15,
    overflow: 'hidden',
    backgroundColor: '#2E7D32',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fallbackImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  destinationOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  propertiesCount: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
});
