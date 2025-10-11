// Types principaux pour l'application AkwaHome

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
  };
}

export interface Property {
  id: string;
  title: string;
  description: string | null;
  location: string;
  price_per_night: number;
  images: string[];
  rating?: number;
  reviews_count?: number;
  amenities?: Amenity[];
  host_id: string;
  created_at: string;
  updated_at: string;
  city_id?: string;
  cities?: {
    id: string;
    name: string;
    region: string;
  };
  max_guests?: number;
  property_type?: string;
  cleaning_fee?: number;
  service_fee?: number;
  is_hidden?: boolean;
  auto_booking?: boolean;
  minimum_nights?: number;
  discount_enabled?: boolean;
  discount_min_nights?: number;
  discount_percentage?: number;
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
  property_id: string;
  guest_id: string;
  host_id: string;
  created_at: string;
  updated_at: string;
  last_message?: Message;
  unread_count?: number;
  property?: {
    title: string;
    images: string[];
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
}

// Types de navigation
export type RootStackParamList = {
  Home: undefined;
  Auth: undefined;
  Search: { destination?: string };
  PropertyDetails: { propertyId: string };
  Booking: { propertyId: string };
  HostProfile: { hostId: string };
  HostBookings: undefined;
  EditProfile: undefined;
  BecomeHost: undefined;
  MyHostApplications: undefined;
  MyProperties: undefined;
  HostDashboard: undefined;
  AdminDashboard: undefined;
  AdminApplications: undefined;
  AdminProperties: undefined;
  AdminUsers: undefined;
  EditProperty: { propertyId: string };
  PropertyCalendar: { propertyId: string };
  MyBookings: undefined;
  Favorites: undefined;
  Messaging: undefined;
  MessagingDebug: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  MessagingTab: { conversationId?: string };
  BookingsTab: undefined;
  FavoritesTab: undefined;
  ProfileTab: undefined;
};

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

// Types pour la navigation
export type RootStackParamList = {
  Home: undefined;
  Search: { destination?: string } | undefined;
  PropertyDetails: { propertyId: string };
  Booking: { propertyId: string };
  Auth: { returnTo?: string; returnParams?: any } | undefined;
  BecomeHost: undefined;
  MyHostApplications: undefined;
  HostDashboard: undefined;
  MyProperties: undefined;
  AddProperty: undefined;
  MyBookings: undefined;
  Messaging: undefined;
  Admin: undefined;
  AdminApplications: undefined;
  AdminProperties: undefined;
  AdminUsers: undefined;
  EditProperty: { propertyId: string };
  PropertyCalendar: { propertyId: string };
  SupabaseTest: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  BookingsTab: undefined;
  FavoritesTab: undefined;
};
