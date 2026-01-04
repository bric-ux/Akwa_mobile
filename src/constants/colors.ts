/**
 * Couleurs par mode de l'application
 * Permet de différencier visuellement chaque mode
 */

// Mode Voyageur (par défaut) - Orange comme sur le site web
export const TRAVELER_COLORS = {
  primary: '#e67e22', // Orange (#e67e22)
  secondary: '#f97316', // Orange-500
  light: '#fff5e6',
  dark: '#d66a1a', // Hover color
};

// Mode Hôte - Vert comme sur le site web
export const HOST_COLORS = {
  primary: '#16a34a', // Green-600
  secondary: '#22c55e', // Green-500
  light: '#dcfce7',
  dark: '#15803d', // Green-700 (hover)
  badge: '#dcfce7',
  badgeText: '#16a34a',
};

// Mode Véhicules - Bleu comme sur le site web
export const VEHICLE_COLORS = {
  primary: '#2563eb', // Blue-600
  secondary: '#3b82f6', // Blue-500
  light: '#dbeafe',
  dark: '#1d4ed8', // Blue-700 (hover)
  badge: '#dbeafe',
  badgeText: '#2563eb',
};

// Couleurs communes
export const COMMON_COLORS = {
  white: '#ffffff',
  black: '#000000',
  gray: '#666666',
  lightGray: '#f8f9fa',
  border: '#e9ecef',
  error: '#e74c3c',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
};

// Fonction utilitaire pour obtenir la couleur selon le mode
export const getModeColor = (mode: 'host' | 'vehicle' | 'traveler' = 'traveler') => {
  switch (mode) {
    case 'host':
      return HOST_COLORS.primary;
    case 'vehicle':
      return VEHICLE_COLORS.primary;
    default:
      return TRAVELER_COLORS.primary;
  }
};

