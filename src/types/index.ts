// Types principaux pour l'application AkwaHome

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
  };
}

export interface CategorizedPhoto {
  id: string;
  url: string;
  category: 'chambre' | 'salle_de_bain' | 'cuisine' | 'jardin' | 'salon' | 'exterieur' | 'terrasse' | 'balcon' | 'salle_a_manger' | 'cave' | 'toilette' | 'buanderie' | 'wc' | 'piscine' | 'autre';
  display_order: number | null;
  created_at: string | null;
  is_main?: boolean;
  isMain?: boolean; // Alias pour compatibilité
}

export interface Property {
  id: string;
  title: string;
  description: string | null;
  location: string | {
    id: string;
    name: string;
    type: 'country' | 'region' | 'city' | 'commune' | 'neighborhood';
    latitude?: number;
    longitude?: number;
    parent_id?: string;
  } | undefined;
  price_per_night: number;
  images: string[]; // Gardé pour compatibilité avec l'ancien système
  photos?: CategorizedPhoto[]; // Nouveau système de photos catégorisées
  rating?: number;
  review_count?: number;
  amenities?: Amenity[];
  custom_amenities?: string[]; // Équipements personnalisés ajoutés par l'hôte
  host_id: string;
  created_at: string;
  updated_at: string;
  location_id?: string;
  location?: {
    id: string;
    name: string;
    type: 'country' | 'region' | 'city' | 'commune' | 'neighborhood';
    latitude?: number;
    longitude?: number;
    parent_id?: string;
  };
  // Garder pour compatibilité avec l'ancien code
  cities?: {
    id: string;
    name: string;
    region: string;
    latitude?: number;
    longitude?: number;
  };
  neighborhoods?: {
    id: string;
    name: string;
    commune: string;
    latitude?: number;
    longitude?: number;
  };
  latitude?: number;
  longitude?: number;
  distance?: number; // Distance en km depuis le centre de recherche (si recherche par rayon)
  max_guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string;
  cleaning_fee?: number;
  free_cleaning_min_days?: number;
  service_fee?: number;
  taxes?: number;
  is_hidden?: boolean;
  auto_booking?: boolean;
  minimum_nights?: number;
  discount_enabled?: boolean;
  discount_min_nights?: number;
  discount_percentage?: number;
  long_stay_discount_enabled?: boolean;
  long_stay_discount_min_nights?: number;
  long_stay_discount_percentage?: number;
  check_in_time?: string;
  check_out_time?: string;
  house_rules?: string;
  smoking_allowed?: boolean;
  vaping_allowed?: boolean;
  events_allowed?: boolean;
  reviews?: {
    rating: number;
    comment: string | null;
    created_at: string;
    reviewer_id: string;
    profiles?: {
      first_name: string;
    };
  }[];
}

export interface Amenity {
  id: string;
  name: string;
  icon: string | null;
  category: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  property_id?: string;
  vehicle_id?: string;
  guest_id: string;
  host_id: string;
  created_at: string;
  updated_at: string;
  last_message?: Message;
  unread_count?: number;
  property?: {
    id: string;
    title: string;
    images: string[];
  };
  vehicle?: {
    id: string;
    brand: string;
    model: string;
    year?: number;
    images?: string[];
  };
  host_profile?: {
    first_name: string;
    last_name: string;
    avatar_url: string;
  };
  guest_profile?: {
    first_name: string;
    last_name: string;
    avatar_url: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
  message_type?: 'text' | 'image' | 'file' | 'system';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  read_at?: string;
  is_edited?: boolean;
  edited_at?: string;
}

export interface Booking {
  id: string;
  property_id: string;
  user_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface SearchFilters {
  city?: string;
  guests?: number;
  adults?: number;
  children?: number;
  babies?: number;
  priceMin?: number;
  priceMax?: number;
  propertyType?: 'apartment' | 'house' | 'villa' | 'eco_lodge' | 'other';
  checkIn?: string;
  checkOut?: string;
  wifi?: boolean;
  parking?: boolean;
  pool?: boolean;
  airConditioning?: boolean;
  amenities?: string[]; // Liste des noms d'équipements sélectionnés
  // Recherche par rayon
  centerLat?: number; // Latitude du centre de recherche
  centerLng?: number; // Longitude du centre de recherche
  radiusKm?: number; // Rayon de recherche en kilomètres
  // Tri des résultats
  sortBy?: 'popular' | 'price_asc' | 'price_desc' | 'rating_desc' | 'recent' | '';
}

// Types de navigation
export type RootStackParamList = {
  Home: undefined;
  HostSpace: { screen?: keyof HostTabParamList } | undefined; // Navigation hôte avec onglets
  VehicleOwnerSpace: { screen?: keyof VehicleOwnerTabParamList } | undefined; // Navigation propriétaire de véhicule avec onglets
  Auth: undefined;
  EmailVerification: { email: string; firstName: string };
  Search: { destination?: string };
  PropertyDetails: { 
    propertyId: string;
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
    babies?: number;
  };
  Booking: { propertyId: string };
  HostProfile: { hostId: string };
  HostBookings: undefined;
  Settings: undefined;
  EditProfile: undefined;
  BecomeHost: undefined;
  MyHostApplications: undefined;
  ApplicationDetails: { applicationId: string };
  MyProperties: undefined;
  HostPaymentInfo: undefined;
  HostStats: undefined;
  GuestReferral: undefined; // Système de parrainage pour les voyageurs
  Admin: undefined;
  AdminApplications: undefined;
  AdminProperties: undefined;
  AdminStats: undefined;
  AdminUsers: undefined;
  AdminIdentityDocuments: undefined;
  AdminHostPaymentInfo: undefined;
  AdminNotifications: undefined;
  AdminReviews: undefined;
  AdminVehicles: undefined;
  AdminPenalties: undefined;
  EditProperty: { propertyId: string };
  PropertyCalendar: { propertyId: string };
  PropertyManagement: { propertyId: string }; // Gestion de propriété avec photos et options
  PropertyPricing: { propertyId: string }; // Tarification
  PropertyRules: { propertyId: string }; // Règlement intérieur
  ModeTransition: { targetMode?: 'host' | 'traveler' | 'vehicle'; targetPath?: string; fromMode?: 'host' | 'traveler' | 'vehicle' }; // Page de transition entre modes
  MyBookings: undefined;
  Favorites: undefined;
  Messaging: undefined;
  MessagingDebug: undefined;
  Conciergerie: undefined;
  Vehicles: undefined;
  VehicleDetails: { vehicleId: string };
  VehicleBooking: { vehicleId: string };
  AddVehicle: undefined;
  MyVehicles: undefined;
  MyVehicleBookings: undefined;
  EditVehicle: { vehicleId: string };
  HostVehicleBookings: { vehicleId?: string };
  Penalties: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  MessagingTab: { conversationId?: string };
  BookingsTab: undefined;
  FavoritesTab: undefined;
  ProfileTab: undefined;
};

export type HostTabParamList = {
  HostPropertiesTab: undefined;
  HostBookingsTab: undefined;
  HostMessagingTab: { conversationId?: string };
  HostStatsTab: undefined;
  HostProfileTab: undefined;
};

export type VehicleOwnerTabParamList = {
  VehicleOwnerVehiclesTab: undefined;
  VehicleOwnerBookingsTab: undefined;
  VehicleOwnerMessagingTab: { conversationId?: string };
  VehicleOwnerStatsTab: undefined;
  VehicleOwnerProfileTab: undefined;
};

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

// Types pour les véhicules
export type VehicleType = 'car' | 'suv' | 'van' | 'truck' | 'motorcycle' | 'scooter' | 'bicycle' | 'other';
export type VehicleBookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type TransmissionType = 'manual' | 'automatic';
export type FuelType = 'essence' | 'diesel' | 'electric' | 'hybrid';

export interface Vehicle {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  vehicle_type: VehicleType;
  brand: string;
  model: string;
  year: number;
  plate_number: string | null;
  seats: number;
  transmission: TransmissionType | null;
  fuel_type: FuelType | null;
  mileage: number | null;
  location_id: string | null;
  location?: {
    id: string;
    name: string;
    type: 'country' | 'region' | 'city' | 'commune' | 'neighborhood';
    latitude?: number;
    longitude?: number;
    parent_id?: string;
  };
  price_per_day: number;
  price_per_week: number | null;
  price_per_month: number | null;
  security_deposit: number;
  is_active: boolean;
  is_featured: boolean;
  minimum_rental_days: number;
  images: string[];
  documents: string[];
  rating: number;
  review_count: number;
  features: string[];
  rules: string[];
  created_at: string;
  updated_at: string;
  photos?: VehiclePhoto[];
  admin_approved?: boolean;
  admin_rejected?: boolean;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  url: string;
  category: 'exterior' | 'interior' | 'engine' | 'documents' | 'other';
  is_main: boolean;
  display_order: number;
  created_at: string;
}

export interface VehicleBooking {
  id: string;
  vehicle_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  rental_days: number;
  daily_rate: number;
  total_price: number;
  security_deposit: number;
  status: VehicleBookingStatus;
  pickup_location: string | null;
  dropoff_location: string | null;
  message_to_owner: string | null;
  special_requests: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancellation_penalty: number;
  created_at: string;
  updated_at: string;
  vehicle?: Vehicle;
  renter?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
}

export interface VehicleReview {
  id: string;
  vehicle_id: string;
  booking_id: string;
  reviewer_id: string;
  rating: number;
  cleanliness_rating: number | null;
  condition_rating: number | null;
  value_rating: number | null;
  communication_rating: number | null;
  comment: string | null;
  approved: boolean;
  created_at: string;
  reviewer?: {
    first_name: string;
    last_name: string;
  };
}

export interface VehicleFilters {
  vehicleType?: VehicleType;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  transmission?: TransmissionType;
  fuelType?: FuelType;
  seats?: number;
  locationId?: string;
  startDate?: string;
  endDate?: string;
  features?: string[];
  search?: string;
}
