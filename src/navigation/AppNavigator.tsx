import React from 'react';
import { NavigationContainer, useNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { HOST_COLORS, VEHICLE_COLORS } from '../constants/colors';

// Screens
import HomeScreen from '../screens/HomeScreen';
import AuthScreen from '../screens/AuthScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import SearchScreen from '../screens/SearchScreen';
import MessagingScreen from '../screens/MessagingScreen';
import PropertyDetailsScreen from '../screens/PropertyDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import HostProfileScreen from '../screens/HostProfileScreen';
import HostBookingsScreen from '../screens/HostBookingsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import SupabaseTestScreen from '../screens/SupabaseTestScreen';
import BecomeHostScreen from '../screens/BecomeHostScreen';
import MyHostApplicationsScreen from '../screens/MyHostApplicationsScreen';
import ApplicationDetailsScreen from '../screens/ApplicationDetailsScreen';
import MyPropertiesScreen from '../screens/MyPropertiesScreen';
import PropertyCalendarScreen from '../screens/PropertyCalendarScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminApplicationsScreen from '../screens/AdminApplicationsScreen';
import AdminPropertiesScreen from '../screens/AdminPropertiesScreen';
import AdminStatsScreen from '../screens/AdminStatsScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminIdentityDocumentsScreen from '../screens/AdminIdentityDocumentsScreen';
import AdminNotificationsScreen from '../screens/AdminNotificationsScreen';
import PdfViewerScreen from '../screens/PdfViewerScreen';
import EditPropertyScreen from '../screens/EditPropertyScreen';
import MessagingDebugScreen from '../screens/MessagingDebugScreen';
import HostPaymentInfoScreen from '../screens/HostPaymentInfoScreen';
import AdminHostPaymentInfoScreen from '../screens/AdminHostPaymentInfoScreen';
import AdminReviewsScreen from '../screens/AdminReviewsScreen';
import AdminVehiclesScreen from '../screens/AdminVehiclesScreen';
import HostStatsScreen from '../screens/HostStatsScreen';
import HostReferralScreen from '../screens/HostReferralScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsScreen from '../screens/TermsScreen';
import PropertyManagementScreen from '../screens/PropertyManagementScreen';
import PropertyPricingScreen from '../screens/PropertyPricingScreen';
import PropertyRulesScreen from '../screens/PropertyRulesScreen';
import GuestReferralScreen from '../screens/GuestReferralScreen';
import ModeTransitionScreen from '../screens/ModeTransitionScreen';
import ConciergerieScreen from '../screens/ConciergerieScreen';
import VehiclesScreen from '../screens/VehiclesScreen';
import VehicleDetailsScreen from '../screens/VehicleDetailsScreen';
import AddVehicleScreen from '../screens/AddVehicleScreen';
import MyVehiclesScreen from '../screens/MyVehiclesScreen';
import HostVehicleBookingsScreen from '../screens/HostVehicleBookingsScreen';
import EditVehicleScreen from '../screens/EditVehicleScreen';
import VehicleOwnerAccountScreen from '../screens/VehicleOwnerAccountScreen';
import VehicleOwnerStatsScreen from '../screens/VehicleOwnerStatsScreen';
import PenaltiesScreen from '../screens/PenaltiesScreen';
import AdminPenaltiesScreen from '../screens/AdminPenaltiesScreen';

// Types
import { RootStackParamList, TabParamList, HostTabParamList, VehicleOwnerTabParamList } from '../types';
import HostAccountScreen from '../screens/HostAccountScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const HostTab = createBottomTabNavigator<HostTabParamList>();
const VehicleOwnerTab = createBottomTabNavigator<VehicleOwnerTabParamList>();

// Tab Navigator
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'MessagingTab') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'BookingsTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'FavoritesTab') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'search-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#e67e22',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Explorer' }}
      />
      <Tab.Screen 
        name="MessagingTab" 
        component={MessagingScreen}
        options={{ tabBarLabel: 'Messages' }}
      />
      <Tab.Screen
        name="BookingsTab"
        component={MyBookingsScreen}
        options={{ tabBarLabel: 'Réservations' }}
      />
      <Tab.Screen 
        name="FavoritesTab" 
        component={FavoritesScreen}
        options={{ tabBarLabel: 'Favoris' }}
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Mon compte' }}
      />
    </Tab.Navigator>
  );
};

// Host Tab Navigator (pour les hôtes)
const HostTabNavigator = () => {
  return (
    <HostTab.Navigator
      initialRouteName="HostPropertiesTab"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'HostPropertiesTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'HostBookingsTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'HostMessagingTab') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'HostStatsTab') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'HostProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'home-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: HOST_COLORS.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <HostTab.Screen 
        name="HostPropertiesTab" 
        component={MyPropertiesScreen}
        options={{ tabBarLabel: 'Propriétés' }}
      />
      <HostTab.Screen
        name="HostBookingsTab"
        component={HostBookingsScreen}
        options={{ tabBarLabel: 'Réservations' }}
      />
      <HostTab.Screen 
        name="HostMessagingTab" 
        component={MessagingScreen}
        options={{ tabBarLabel: 'Messages' }}
      />
      <HostTab.Screen 
        name="HostStatsTab" 
        component={HostStatsScreen}
        options={{ tabBarLabel: 'Statistiques' }}
      />
      <HostTab.Screen 
        name="HostProfileTab" 
        component={HostAccountScreen}
        options={{ tabBarLabel: 'Mon compte' }}
      />
    </HostTab.Navigator>
  );
};

// Vehicle Owner Tab Navigator (pour les propriétaires de véhicules)
const VehicleOwnerTabNavigator = () => {
  return (
    <VehicleOwnerTab.Navigator
      initialRouteName="VehicleOwnerVehiclesTab"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'VehicleOwnerVehiclesTab') {
            iconName = focused ? 'car' : 'car-outline';
          } else if (route.name === 'VehicleOwnerBookingsTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'VehicleOwnerMessagingTab') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'VehicleOwnerStatsTab') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'VehicleOwnerProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'car-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: VEHICLE_COLORS.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <VehicleOwnerTab.Screen 
        name="VehicleOwnerVehiclesTab" 
        component={MyVehiclesScreen}
        options={{ tabBarLabel: 'Véhicules' }}
      />
      <VehicleOwnerTab.Screen
        name="VehicleOwnerBookingsTab"
        component={HostVehicleBookingsScreen}
        options={{ tabBarLabel: 'Réservations' }}
      />
      <VehicleOwnerTab.Screen 
        name="VehicleOwnerMessagingTab" 
        component={MessagingScreen}
        options={{ tabBarLabel: 'Messages' }}
      />
      <VehicleOwnerTab.Screen 
        name="VehicleOwnerStatsTab" 
        component={VehicleOwnerStatsScreen}
        options={{ tabBarLabel: 'Statistiques' }}
      />
      <VehicleOwnerTab.Screen 
        name="VehicleOwnerProfileTab" 
        component={VehicleOwnerAccountScreen}
        options={{ tabBarLabel: 'Mon compte' }}
      />
    </VehicleOwnerTab.Navigator>
  );
};

// Main Stack Navigator
const AppNavigator = () => {
  const navigationRef = useNavigationContainerRef();
  const { user, loading: authLoading } = useAuth();
  const hasCheckedMode = React.useRef(false);

  React.useEffect(() => {
    const checkAndNavigate = async () => {
      if (!authLoading && user && !hasCheckedMode.current) {
        // Attendre que le navigator soit prêt
        const checkReady = setInterval(() => {
          if (navigationRef.isReady()) {
            clearInterval(checkReady);
            hasCheckedMode.current = true;
            (async () => {
              try {
                const preferredMode = await AsyncStorage.getItem('preferredMode');
                
                // Vérifier que l'utilisateur est bien hôte avant d'appliquer le mode hôte
                if (preferredMode === 'host') {
                  // Vérifier le statut hôte dans le profil
                  const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('is_host')
                    .eq('user_id', user.id)
                    .single();

                  if (profileError) {
                    console.error('Error checking host status:', profileError);
                    // En cas d'erreur, ne pas appliquer le mode hôte
                    await AsyncStorage.setItem('preferredMode', 'traveler');
                    return;
                  }

                  // Vérifier aussi si l'utilisateur a des propriétés (au cas où is_host serait false mais qu'il ait des propriétés)
                  const { data: properties } = await supabase
                    .from('properties')
                    .select('id')
                    .eq('host_id', user.id)
                    .limit(1);

                  const isHost = profile?.is_host || (properties && properties.length > 0);

                  if (isHost) {
                    navigationRef.dispatch(
                      CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'HostSpace' }],
                      })
                    );
                  } else {
                    // L'utilisateur n'est pas hôte, réinitialiser le mode préféré
                    await AsyncStorage.setItem('preferredMode', 'traveler');
                  }
                } else if (preferredMode === 'vehicle') {
                  // Vérifier si l'utilisateur a des véhicules
                  const { data: vehicles } = await supabase
                    .from('vehicles')
                    .select('id')
                    .eq('owner_id', user.id)
                    .limit(1);

                  if (vehicles && vehicles.length > 0) {
                    navigationRef.dispatch(
                      CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'VehicleOwnerSpace' }],
                      })
                    );
                  } else {
                    // L'utilisateur n'a pas de véhicules, réinitialiser le mode préféré
                    await AsyncStorage.setItem('preferredMode', 'traveler');
                  }
                }
              } catch (error) {
                console.error('Error checking preferred mode:', error);
                // En cas d'erreur, réinitialiser le mode préféré
                await AsyncStorage.setItem('preferredMode', 'traveler');
              }
            })();
          }
        }, 100);

        // Nettoyer après 5 secondes max
        setTimeout(() => clearInterval(checkReady), 5000);
      }
    };

    checkAndNavigate();
  }, [user, authLoading, navigationRef]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: HOST_COLORS.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerBackTitle: 'Retour',
          // Animation de retour de gauche vers la droite (comme iOS)
          gestureDirection: 'horizontal',
          gestureEnabled: true,
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="HostSpace" 
          component={HostTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="VehicleOwnerSpace" 
          component={VehicleOwnerTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Auth" 
          component={AuthScreen}
          options={{ 
            title: 'Authentification',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="EmailVerification" 
          component={EmailVerificationScreen}
          options={{ 
            title: 'Vérification d\'email',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="Search" 
          component={SearchScreen}
          options={{ 
            title: 'Rechercher',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="PropertyDetails" 
          component={PropertyDetailsScreen}
          options={{ 
            title: 'Détails de la propriété',
            headerBackTitle: 'Retour'
          }}
        />
        <Stack.Screen 
          name="Booking" 
          component={BookingScreen}
          options={{ 
            title: 'Réservation',
            headerBackTitle: 'Retour'
          }}
        />
        <Stack.Screen 
          name="HostProfile" 
          component={HostProfileScreen}
          options={{ 
            title: 'Profil de l\'hôte',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="HostBookings" 
          component={HostBookingsScreen}
          options={{ 
            title: 'Gestion des réservations',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{ 
            title: 'Paramètres',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="EditProfile" 
          component={EditProfileScreen}
          options={{ 
            title: 'Modifier le profil',
            headerShown: false 
          }}
        />
            <Stack.Screen 
              name="BecomeHost" 
              component={BecomeHostScreen}
              options={{ 
                title: 'Devenir hôte',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="MyHostApplications" 
              component={MyHostApplicationsScreen}
              options={{ 
                title: 'Mes candidatures',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="ApplicationDetails" 
              component={ApplicationDetailsScreen}
              options={{ 
                title: 'Détails de la candidature',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="HostReferral" 
              component={HostReferralScreen}
              options={{ 
                title: 'Système de Parrainage',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="GuestReferral" 
              component={GuestReferralScreen}
              options={{ 
                title: 'Système de Parrainage',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="HostPaymentInfo" 
              component={HostPaymentInfoScreen}
              options={{ 
                title: 'Informations de paiement',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="HostStats" 
              component={HostStatsScreen}
              options={{ 
                title: 'Statistiques détaillées',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="MyProperties" 
              component={MyPropertiesScreen}
              options={{ 
                title: 'Gestion des propriétés',
                headerShown: false 
              }}
            />
        <Stack.Screen 
          name="MyBookings" 
          component={MyBookingsScreen}
          options={{ 
            title: 'Mes réservations',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="Messaging" 
          component={AuthScreen} // Placeholder
          options={{ 
            title: 'Messages',
            headerBackTitle: 'Retour'
          }}
        />
            <Stack.Screen 
              name="Admin" 
              component={AdminDashboardScreen}
              options={{ 
                title: 'Administration',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="AdminApplications" 
              component={AdminApplicationsScreen}
              options={{ 
                title: 'Candidatures d\'hôtes',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="AdminProperties" 
              component={AdminPropertiesScreen}
              options={{ 
                title: 'Gestion des propriétés',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="AdminStats" 
              component={AdminStatsScreen}
              options={{ 
                title: 'Statistiques détaillées',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="AdminUsers" 
              component={AdminUsersScreen}
              options={{ 
                title: 'Gestion des utilisateurs',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="AdminIdentityDocuments" 
              component={AdminIdentityDocumentsScreen}
              options={{ 
                title: 'Documents d\'identité',
                headerShown: false 
              }}
            />
            <Stack.Screen
              name="AdminHostPaymentInfo"
              component={AdminHostPaymentInfoScreen}
              options={{
                title: 'Informations de paiement hôtes',
                headerShown: false
              }}
            />
            <Stack.Screen
              name="AdminNotifications"
              component={AdminNotificationsScreen}
              options={{
                title: 'Gestion des notifications',
                headerShown: false
              }}
            />
            <Stack.Screen
              name="AdminReviews"
              component={AdminReviewsScreen}
              options={{
                title: 'Validation des avis',
                headerShown: false
              }}
            />
            <Stack.Screen
              name="AdminVehicles"
              component={AdminVehiclesScreen}
              options={{
                title: 'Validation des véhicules',
                headerShown: false
              }}
            />
            <Stack.Screen
              name="AdminPenalties"
              component={AdminPenaltiesScreen}
              options={{
                title: 'Gestion des pénalités',
                headerShown: false
              }}
            />
            <Stack.Screen 
              name="EditProperty" 
              component={EditPropertyScreen}
              options={{ 
                title: 'Modifier la propriété',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="PropertyCalendar" 
              component={PropertyCalendarScreen}
              options={{ 
                title: 'Calendrier de disponibilité',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="PropertyManagement" 
              component={PropertyManagementScreen}
              options={{ 
                title: 'Gestion de la propriété',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="PropertyPricing" 
              component={PropertyPricingScreen}
              options={{ 
                title: 'Tarification',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="PropertyRules" 
              component={PropertyRulesScreen}
              options={{ 
                title: 'Règlement intérieur',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="ModeTransition" 
              component={ModeTransitionScreen}
              options={{ 
                headerShown: false,
                gestureEnabled: false,
              }}
            />
        <Stack.Screen 
          name="SupabaseTest" 
          component={SupabaseTestScreen}
          options={{ 
            title: 'Test Supabase',
            headerBackTitle: 'Retour'
          }}
        />
        <Stack.Screen 
          name="PdfViewer" 
          component={PdfViewerScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="PrivacyPolicy" 
          component={PrivacyPolicyScreen}
          options={{ 
            title: 'Politique de confidentialité',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="Terms" 
          component={TermsScreen}
          options={{ 
            title: "Conditions d'utilisation",
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="MessagingDebug" 
          component={MessagingDebugScreen}
          options={{ 
            title: 'Debug Messagerie',
            headerBackTitle: 'Retour'
          }}
        />
            <Stack.Screen 
              name="Conciergerie" 
              component={ConciergerieScreen}
              options={{ 
                title: 'Conciergerie',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="Vehicles" 
              component={VehiclesScreen}
              options={{ 
                title: 'Location de véhicules',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="VehicleDetails" 
              component={VehicleDetailsScreen}
              options={{ 
                title: 'Détails du véhicule',
                headerShown: true 
              }}
            />
            <Stack.Screen 
              name="AddVehicle" 
              component={AddVehicleScreen}
              options={{ 
                title: 'Ajouter un véhicule',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="MyVehicles" 
              component={MyVehiclesScreen}
              options={{ 
                title: 'Mes véhicules',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="EditVehicle" 
              component={EditVehicleScreen}
              options={{ 
                title: 'Modifier le véhicule',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="HostVehicleBookings" 
              component={HostVehicleBookingsScreen}
              options={{ 
                title: 'Réservations de véhicules',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="Penalties" 
              component={PenaltiesScreen}
              options={{ 
                title: 'Remboursements & Pénalités',
                headerShown: false 
              }}
            />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
