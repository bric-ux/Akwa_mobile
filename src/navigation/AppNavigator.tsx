import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Screens
import HomeScreen from '../screens/HomeScreen';
import AuthScreen from '../screens/AuthScreen';
import SearchScreen from '../screens/SearchScreen';
import MessagingScreen from '../screens/MessagingScreen';
import PropertyDetailsScreen from '../screens/PropertyDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FavoritesScreen from '../screens/FavoritesScreen';

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
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'SearchTab') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'BookingsTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'FavoritesTab') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else {
            iconName = 'home-outline';
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
        options={{ tabBarLabel: 'Accueil' }}
      />
      <Tab.Screen 
        name="SearchTab" 
        component={MessagingScreen}
        options={{ tabBarLabel: 'Messagerie' }}
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
          name="Profile" 
          component={ProfileScreen}
          options={{ 
            title: 'Profil',
            headerShown: false 
          }}
        />
        <Stack.Screen 
          name="BecomeHost" 
          component={AuthScreen} // Placeholder
          options={{ title: 'Devenir hôte' }}
        />
        <Stack.Screen 
          name="HostDashboard" 
          component={AuthScreen} // Placeholder
          options={{ title: 'Tableau de bord hôte' }}
        />
        <Stack.Screen 
          name="AddProperty" 
          component={AuthScreen} // Placeholder
          options={{ title: 'Ajouter une propriété' }}
        />
        <Stack.Screen 
          name="MyBookings" 
          component={AuthScreen} // Placeholder
          options={{ title: 'Mes réservations' }}
        />
        <Stack.Screen 
          name="Messaging" 
          component={AuthScreen} // Placeholder
          options={{ title: 'Messages' }}
        />
        <Stack.Screen 
          name="Admin" 
          component={AuthScreen} // Placeholder
          options={{ title: 'Administration' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
