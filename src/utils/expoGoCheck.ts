import Constants from 'expo-constants';

/**
 * Vérifie si l'application tourne dans Expo Go
 * Expo Go ne supporte pas certains modules natifs comme react-native-webview
 */
export const isExpoGo = (): boolean => {
  try {
    // Dans Expo Go, Constants.executionEnvironment est 'storeClient'
    // Dans un développement build, c'est 'standalone' ou 'bare'
    const executionEnv = Constants.executionEnvironment;
    
    if (executionEnv === 'storeClient') {
      return true;
    }
    
    // Vérifier si le module WebView peut être chargé
    try {
      require('react-native-webview');
      return false; // WebView disponible, donc pas Expo Go
    } catch {
      return true; // WebView non disponible, probablement Expo Go
    }
  } catch (error) {
    // En cas d'erreur, supposer qu'on est dans Expo Go pour être sûr
    return true;
  }
};

