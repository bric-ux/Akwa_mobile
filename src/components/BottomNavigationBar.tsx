import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { TRAVELER_COLORS } from '../constants/colors';

interface BottomNavigationBarProps {
  activeScreen?: 'explorer' | 'recherche' | 'messages' | 'favoris' | 'compte';
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ 
  activeScreen = 'recherche' 
}) => {
  const navigation = useNavigation();

  return (
    <View style={styles.bottomNavigation}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          // Vérifier si on est dans la section véhicule
          const state = navigation.getState();
          const currentRoute = state.routes[state.index];
          
          // Liste des écrans de la section véhicule
          const vehicleScreens = [
            'Vehicles',
            'VehicleDetails',
            'VehicleBooking',
            'AddVehicle',
            'MyVehicles',
            'EditVehicle',
            'VehicleManagement',
            'VehicleCalendar',
            'VehiclePricing',
            'VehicleReviews',
            'HostVehicleBookings',
            'MyVehicleBookings',
          ];
          
          const isInVehicleSection = vehicleScreens.includes(currentRoute.name);
          
          if (isInVehicleSection) {
            // Demander confirmation avant de quitter la section véhicule
            Alert.alert(
              'Retour à la recherche',
              'Voulez-vous vraiment retourner sur la recherche de résidences meublées ?',
              [
                {
                  text: 'Annuler',
                  style: 'cancel',
                },
                {
                  text: 'Oui',
                  onPress: () => {
                    // Naviguer vers HomeTab (Explorer pour résidences meublées)
                    (navigation as any).navigate('Home', { screen: 'HomeTab' });
                  },
                },
              ]
            );
          } else {
            // Naviguer directement si on n'est pas dans la section véhicule
            (navigation as any).navigate('Home', { screen: 'HomeTab' });
          }
        }}
      >
        <Ionicons 
          name={activeScreen === 'explorer' ? 'search' : 'search-outline'} 
          size={24} 
          color={activeScreen === 'explorer' ? TRAVELER_COLORS.primary : '#999'} 
        />
        <Text style={[
          styles.navLabel,
          activeScreen === 'explorer' && styles.navLabelActive
        ]}>
          Explorer
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          // Naviguer vers VehiclesScreen (Recherche véhicules)
          navigation.navigate('Vehicles' as never);
        }}
      >
        <Ionicons 
          name={activeScreen === 'recherche' ? 'car' : 'car-outline'} 
          size={24} 
          color={activeScreen === 'recherche' ? TRAVELER_COLORS.primary : '#999'} 
        />
        <Text style={[
          styles.navLabel,
          activeScreen === 'recherche' && styles.navLabelActive
        ]}>
          Recherche
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          // Utiliser le TabNavigator au lieu du Stack pour éviter le rechargement
          (navigation as any).navigate('Home', { screen: 'MessagingTab' });
        }}
      >
        <Ionicons 
          name={activeScreen === 'messages' ? 'chatbubbles' : 'chatbubbles-outline'} 
          size={24} 
          color={activeScreen === 'messages' ? TRAVELER_COLORS.primary : '#999'} 
        />
        <Text style={[
          styles.navLabel,
          activeScreen === 'messages' && styles.navLabelActive
        ]}>
          Messages
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          // Utiliser le TabNavigator au lieu du Stack pour éviter le rechargement
          (navigation as any).navigate('Home', { screen: 'FavoritesTab' });
        }}
      >
        <Ionicons 
          name={activeScreen === 'favoris' ? 'heart' : 'heart-outline'} 
          size={24} 
          color={activeScreen === 'favoris' ? TRAVELER_COLORS.primary : '#999'} 
        />
        <Text style={[
          styles.navLabel,
          activeScreen === 'favoris' && styles.navLabelActive
        ]}>
          Favoris
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          // Vérifier si on est déjà sur Profile pour éviter les doublons
          const state = navigation.getState();
          const currentRoute = state.routes[state.index];
          
          // Si on est déjà sur Profile (Stack) ou ProfileTab, ne rien faire
          if (currentRoute.name === 'Profile' || currentRoute.name === 'ProfileTab') {
            // Si on peut revenir en arrière, le faire
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          } else {
            // Sinon, naviguer vers ProfileTab
            (navigation as any).navigate('Home', { screen: 'ProfileTab' });
          }
        }}
      >
        <Ionicons 
          name={activeScreen === 'compte' ? 'person' : 'person-outline'} 
          size={24} 
          color={activeScreen === 'compte' ? TRAVELER_COLORS.primary : '#999'} 
        />
        <Text style={[
          styles.navLabel,
          activeScreen === 'compte' && styles.navLabelActive
        ]}>
          Mon compte
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 20,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontWeight: '500',
  },
  navLabelActive: {
    color: TRAVELER_COLORS.primary,
    fontWeight: '600',
  },
});

export default BottomNavigationBar;

