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
    'Espace de rangement': '📦',
    'Armoire': '📦',
    'Cuisinière': '🍳',
    'Four': '🔥',
  };

  return iconMap[amenityName] || '🏠'; // Icône par défaut
};

// Mapping des équipements vers les icônes Ionicons pour les filtres
export const getAmenityIonicIcon = (amenityName: string): string => {
  const iconMap: Record<string, string> = {
    // Connectivité
    'WiFi gratuit': 'wifi',
    
    // Confort
    'Climatisation': 'snow',
    'Chauffage': 'flame',
    'Ventilateur': 'leaf',
    'Eau chaude': 'water-outline',
    
    // Cuisine
    'Cuisine équipée': 'restaurant',
    'Micro-ondes': 'radio',
    'Réfrigérateur': 'snow',
    'Congélateur': 'snow',
    'Cuisinière': 'flame',
    'Four': 'flame',
    'Lave-vaisselle': 'water',
    
    // Buanderie
    'Machine à laver': 'shirt',
    'Sèche-linge': 'leaf',
    'Fer à repasser': 'shirt',
    
    // Parking
    'Parking gratuit': 'car',
    'Garage': 'car-sport',
    
    // Récréation
    'Piscine': 'water',
    'Jacuzzi': 'water-outline',
    'Sauna': 'flame-outline',
    'Terrasse': 'sunny',
    'Jardin': 'leaf',
    'Balcon': 'home',
    'Balcon/Terrasse': 'home',
    
    // Divertissement
    'TV écran plat': 'tv',
    'Télévision': 'tv',
    'Câble/Satellite': 'radio',
    'Netflix': 'play',
    'Jeux vidéo': 'game-controller',
    'Livres': 'library',
    'Musique': 'musical-notes',
    
    // Fitness
    'Salle de sport': 'barbell',
    'Équipement fitness': 'barbell',
    'Yoga': 'leaf',
    'Espace de rangement': 'archive-outline',
    'Armoire': 'archive-outline',
    
    // Localisation
    'Accès plage': 'beach',
    'Vue sur mer': 'water',
    'Centre-ville': 'business',
    'Transport public': 'bus',
    
    // Services
    'Service de ménage': 'sparkles',
    'Petit-déjeuner inclus': 'cafe',
    'Concierge': 'people',
    'Transfer aéroport': 'airplane',
    'Réception 24h/24': 'time',
    'Room service': 'restaurant',
    
    // Politiques
    'Animaux acceptés': 'paw',
    'Non-fumeur': 'ban',
    'Fumeur autorisé': 'cigarette',
    
    // Sécurité
    'Coffre-fort': 'lock-closed',
    'Système de sécurité': 'shield',
    'Caméras de surveillance': 'videocam',
    'Interphone': 'call',
    
    // Divers
    'Linge de maison fourni': 'bed',
    'Serviettes': 'water',
    'Produits de toilette': 'medical',
    'Ascenseur': 'business-outline',
    'Escalier': 'stairs',
    'Accès handicapés': 'accessibility',
    'Chauffage central': 'flame',
  };

  // Recherche par mots-clés si pas de correspondance exacte
  const lowerName = amenityName.toLowerCase();
  if (lowerName.includes('wifi') || lowerName.includes('internet')) return 'wifi';
  if (lowerName.includes('parking') || lowerName.includes('voiture') || lowerName.includes('garage')) return 'car';
  if (lowerName.includes('piscine')) return 'water';
  if (lowerName.includes('jacuzzi')) return 'water-outline';
  if (lowerName.includes('sauna')) return 'flame-outline';
  if (lowerName.includes('ascenseur') || lowerName.includes('elevator')) return 'business-outline';
  if (lowerName.includes('eau chaude') || lowerName.includes('douche')) return 'water-outline';
  if (lowerName.includes('armoire') || lowerName.includes('rangement') || lowerName.includes('placard')) return 'archive-outline';
  if (lowerName.includes('cuisinière')) return 'flame';
  if (lowerName.includes('four')) return 'flame';
  if (lowerName.includes('congélateur') || lowerName.includes('freezer')) return 'snow';
  if (lowerName.includes('climatisation') || lowerName.includes('air')) return 'snow';
  if (lowerName.includes('cuisine')) return 'restaurant';
  if (lowerName.includes('machine à laver') || lowerName.includes('lave-linge')) return 'shirt';
  if (lowerName.includes('télévision') || lowerName.includes('tv')) return 'tv';
  
  return iconMap[amenityName] || 'home'; // Icône par défaut
};

// Fonction pour obtenir l'icône d'un équipement avec fallback
export const getAmenityIconWithFallback = (amenityName: string, fallbackIcon?: string): string => {
  return getAmenityIcon(amenityName) || fallbackIcon || '🏠';
};


