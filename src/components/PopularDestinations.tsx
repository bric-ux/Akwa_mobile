import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';

interface Destination {
  id: string;
  name: string;
  image: string;
  propertiesCount: number;
}

interface PopularDestinationsProps {
  destinations: Destination[];
  onDestinationPress?: (destination: Destination) => void;
}

export const PopularDestinations: React.FC<PopularDestinationsProps> = ({
  destinations,
  onDestinationPress,
}) => {
  const renderDestinationCard = (destination: Destination) => (
    <TouchableOpacity
      key={destination.id}
      style={styles.destinationCard}
      onPress={() => onDestinationPress?.(destination)}
    >
      <Image
        source={{ uri: destination.image }}
        style={styles.destinationImage}
        resizeMode="cover"
      />
      
      <View style={styles.destinationOverlay}>
        <Text style={styles.destinationName}>{destination.name}</Text>
        <Text style={styles.propertiesCount}>
          {destination.propertiesCount} propriétés
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Destinations populaires</Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {destinations.map(renderDestinationCard)}
      </ScrollView>
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  destinationImage: {
    width: '100%',
    height: '100%',
  },
  destinationOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
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
});
