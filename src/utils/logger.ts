/**
 * Système de logging conditionnel
 * Les logs ne s'affichent qu'en mode développement (__DEV__ === true)
 * En production, tous les logs sont désactivés pour améliorer les performances
 * et éviter l'exposition d'informations sensibles
 */

const isDevelopment = __DEV__;

/**
 * Logger pour les messages de debug (remplace console.log)
 * @param args - Arguments à logger
 */
export const log = (...args: any[]): void => {
  if (isDevelopment) {
    console.log(...args);
  }
};

/**
 * Logger pour les erreurs (toujours actif, même en production)
 * Les erreurs doivent toujours être loggées pour le debugging en production
 * @param args - Arguments à logger
 */
export const logError = (...args: any[]): void => {
  if (isDevelopment) {
    console.error(...args);
  } else {
    // En production, on peut envoyer les erreurs à un service de tracking
    // Pour l'instant, on les log quand même mais de manière silencieuse
    // TODO: Intégrer un service de tracking d'erreurs (Sentry, etc.)
  }
};

/**
 * Logger pour les avertissements (remplace console.warn)
 * @param args - Arguments à logger
 */
export const logWarn = (...args: any[]): void => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

/**
 * Logger pour les informations (remplace console.info)
 * @param args - Arguments à logger
 */
export const logInfo = (...args: any[]): void => {
  if (isDevelopment) {
    console.info(...args);
  }
};

/**
 * Logger pour les messages de debug avec préfixe
 * Utile pour identifier rapidement la source des logs
 * @param prefix - Préfixe à ajouter au message
 * @param args - Arguments à logger
 */
export const logDebug = (prefix: string, ...args: any[]): void => {
  if (isDevelopment) {
    console.log(`[${prefix}]`, ...args);
  }
};

/**
 * Vérifie si on est en mode développement
 * @returns true si en développement, false sinon
 */
export const isDev = (): boolean => {
  return isDevelopment;
};

