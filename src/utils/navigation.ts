import { NavigationProp } from '@react-navigation/native';

/**
 * Navigate back safely, checking if there's a screen to go back to
 * If there's no screen to go back to, it will navigate to a fallback screen
 */
export const safeGoBack = (
  navigation: NavigationProp<any>,
  fallbackScreen?: string,
  fallbackParams?: any
) => {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else if (fallbackScreen) {
    navigation.navigate(fallbackScreen as never, fallbackParams as never);
  } else {
    // Default fallback to Home if no fallback screen is provided
    navigation.navigate('Home' as never);
  }
};























