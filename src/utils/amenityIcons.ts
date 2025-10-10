// Mapping des équipements vers leurs icônes appropriées
export const getAmenityIcon = (amenityName: string): string => {
  const iconMap: Record<string, string> = {
    // Connectivité
    'WiFi gratuit': '📶',
    
    // Confort
    'Climatisation': '❄️',
    'Chauffage': '🔥',
    'Ventilateur': '🌀',
    
    // Cuisine
    'Cuisine équipée': '🍳',
    'Micro-ondes': '📱',
    'Réfrigérateur': '🧊',
    'Congélateur': '❄️',
    'Lave-vaisselle': '🍽️',
    
    // Buanderie
    'Machine à laver': '🧺',
    'Sèche-linge': '🌪️',
    'Fer à repasser': '👔',
    
    // Parking
    'Parking gratuit': '🅿️',
    'Garage': '🏠',
    
    // Récréation
    'Piscine': '🏊‍♂️',
    'Jacuzzi': '🛁',
    'Sauna': '🧖‍♂️',
    'Terrasse': '🏖️',
    'Jardin': '🌳',
    'Balcon': '🌿',
    'Balcon/Terrasse': '🌿',
    
    // Divertissement
    'TV écran plat': '📺',
    'Câble/Satellite': '📡',
    'Netflix': '🎬',
    'Jeux vidéo': '🎮',
    'Livres': '📚',
    'Musique': '🎵',
    
    // Fitness
    'Salle de sport': '💪',
    'Équipement fitness': '🏋️‍♂️',
    'Yoga': '🧘‍♀️',
    
    // Localisation
    'Accès plage': '🏖️',
    'Vue sur mer': '🌊',
    'Centre-ville': '🏙️',
    'Transport public': '🚌',
    
    // Services
    'Service de ménage': '🧹',
    'Petit-déjeuner inclus': '🍳',
    'Concierge': '🎩',
    'Transfer aéroport': '✈️',
    'Réception 24h/24': '🕐',
    'Room service': '🍽️',
    
    // Politiques
    'Animaux acceptés': '🐕',
    'Non-fumeur': '🚭',
    'Fumeur autorisé': '🚬',
    
    // Sécurité
    'Coffre-fort': '🔒',
    'Système de sécurité': '🛡️',
    'Caméras de surveillance': '📹',
    'Interphone': '📞',
    
    // Divers
    'Linge de maison fourni': '🛏️',
    'Serviettes': '🛁',
    'Produits de toilette': '🧴',
    'Ascenseur': '🛗',
    'Escalier': '🪜',
    'Accès handicapés': '♿',
    'Chauffage central': '🔥',
    'Eau chaude': '🚿',
  };

  return iconMap[amenityName] || '🏠'; // Icône par défaut
};

// Fonction pour obtenir l'icône d'un équipement avec fallback
export const getAmenityIconWithFallback = (amenityName: string, fallbackIcon?: string): string => {
  return getAmenityIcon(amenityName) || fallbackIcon || '🏠';
};
