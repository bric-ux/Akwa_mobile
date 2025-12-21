/**
 * Couleurs par mode de l'application
 * Permet de différencier visuellement chaque mode
 */

// Mode Voyageur (par défaut)
export const TRAVELER_COLORS = {
  primary: '#2563eb', // Bleu
  secondary: '#3b82f6',
  light: '#dbeafe',
  dark: '#1e40af',
};

// Mode Hôte
export const HOST_COLORS = {
  primary: '#e67e22', // Orange
  secondary: '#f97316',
  light: '#fff5e6',
  dark: '#d66a1a',
  badge: '#fff5e6',
  badgeText: '#e67e22',
};

// Mode Véhicules
export const VEHICLE_COLORS = {
  primary: '#475569', // Slate/Gris foncé
  secondary: '#64748b',
  light: '#f1f5f9',
  dark: '#334155',
  badge: '#f1f5f9',
  badgeText: '#475569',
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

