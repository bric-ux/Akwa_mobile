import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

export type DeviceCoords = {
  latitude: number;
  longitude: number;
};

export async function requestDeviceLocation(): Promise<DeviceCoords | null> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    Alert.alert(
      'GPS désactivé',
      'Activez la localisation sur votre appareil pour rechercher autour de vous.',
    );
    return null;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Localisation refusée',
      'Autorisez AkwaHome à accéder à votre position pour trouver les logements à proximité.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Réglages', onPress: () => void Linking.openSettings() },
      ],
    );
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
