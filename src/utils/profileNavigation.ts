import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';

export type HostProfileRouteParams = RootStackParamList['HostProfile'];

/** Paramètres à passer lors d'une navigation interne vers le profil (ex. fiche logement). */
export function buildHostProfileInternalParams(
  params: Omit<HostProfileRouteParams, 'returnFromInternal'>,
): HostProfileRouteParams {
  return { ...params, returnFromInternal: true };
}

/**
 * Retour depuis la vitrine profil :
 * - navigation interne → page précédente (goBack)
 * - lien partagé / entrée directe sans historique → accueil
 */
export function handleHostProfileBack(
  navigation: NavigationProp<RootStackParamList>,
  routeParams?: Pick<HostProfileRouteParams, 'returnFromInternal'>,
): void {
  if (routeParams?.returnFromInternal && navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  navigation.navigate('Home');
}
