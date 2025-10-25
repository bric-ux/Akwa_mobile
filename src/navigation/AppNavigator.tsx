import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

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
import MyPropertiesScreen from '../screens/MyPropertiesScreen';
import HostDashboardScreen from '../screens/HostDashboardScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminApplicationsScreen from '../screens/AdminApplicationsScreen';
import AdminPropertiesScreen from '../screens/AdminPropertiesScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminIdentityDocumentsScreen from '../screens/AdminIdentityDocumentsScreen';
import EditPropertyScreen from '../screens/EditPropertyScreen';
import PropertyCalendarScreen from '../screens/PropertyCalendarScreen';
import MessagingDebugScreen from '../screens/MessagingDebugScreen';

// Types
import { RootStackParamList, TabParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

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
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
};

// Main Stack Navigator
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#e67e22',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
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
          options={{ title: 'Détails de la propriété' }}
        />
        <Stack.Screen 
          name="Booking" 
          component={BookingScreen}
          options={{ title: 'Réservation' }}
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
            title: 'Mes réservations',
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
              name="HostDashboard" 
              component={HostDashboardScreen}
              options={{ 
                title: 'Tableau de bord hôte',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="MyProperties" 
              component={MyPropertiesScreen}
              options={{ 
                title: 'Mes propriétés',
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
          options={{ title: 'Messages' }}
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
          name="SupabaseTest" 
          component={SupabaseTestScreen}
          options={{ title: 'Test Supabase' }}
        />
        <Stack.Screen 
          name="MessagingDebug" 
          component={MessagingDebugScreen}
          options={{ title: 'Debug Messagerie' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
