import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';

export const useAuthRedirect = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const requireAuth = (action: () => void, returnTo?: string, returnParams?: any) => {
    if (user) {
      // Utilisateur connecté, exécuter l'action
      action();
    } else {
      // Utilisateur non connecté, rediriger vers la connexion
      navigation.navigate('Auth', { 
        returnTo: returnTo || 'Home', 
        returnParams: returnParams 
      });
    }
  };

  const requireAuthForBooking = (propertyId: string) => {
    requireAuth(
      () => {
        navigation.navigate('PropertyDetails', { propertyId });
      },
      'PropertyDetails',
      { propertyId }
    );
  };

  const requireAuthForFavorites = (action: () => void) => {
    requireAuth(action, 'Home');
  };

  const requireAuthForProfile = () => {
    requireAuth(
      () => {
        navigation.navigate('Profile');
      },
      'Profile'
    );
  };

  const requireAuthForBookings = () => {
    requireAuth(
      () => {
        navigation.navigate('MyBookings');
      },
      'MyBookings'
    );
  };

  return {
    requireAuth,
    requireAuthForBooking,
    requireAuthForFavorites,
    requireAuthForProfile,
    requireAuthForBookings,
    isAuthenticated: !!user
  };
};
