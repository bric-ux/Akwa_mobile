import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { TRAVELER_COLORS } from '../constants/colors';
import { useLanguage } from '../contexts/LanguageContext';

interface BottomNavigationBarProps {
  activeScreen?: 'explorer' | 'recherche' | 'messages' | 'favoris' | 'compte';
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ 
  activeScreen = 'recherche' 
}) => {
  const navigation = useNavigation();
  const { t } = useLanguage();

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
              t('nav.backToSearch'),
              t('nav.backToSearchDesc'),
              [
                {
                  text: t('common.cancel'),
                  style: 'cancel',
                },
                {
                  text: t('common.yes'),
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
          {t('nav.explore')}
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
          {t('nav.search')}
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
          {t('nav.messages')}
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
          {t('nav.favorites')}
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
          {t('nav.myAccount')}
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
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    paddingBottom: 8,
    paddingTop: 8,
    zIndex: 100,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
  navLabelActive: {
    color: TRAVELER_COLORS.primary,
    fontWeight: '600',
  },
});

export default BottomNavigationBar;
