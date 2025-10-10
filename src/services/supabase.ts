import { createClient } from '@supabase/supabase-js';

// Configuration Supabase - Valeurs de votre projet
const supabaseUrl = 'https://hqzgndjbxzgsyfoictgo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxemduZGpieHpnc3lmb2ljdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDY5MzMsImV4cCI6MjA3NDI4MjkzM30.szs7OldmsdT9fIW59bW-r44R_VZ8roUvYeJeArK3ClM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // Options de débogage pour React Native
  global: {
    headers: {
      'X-Client-Info': 'akwa-home-mobile',
    },
  },
  // Configuration pour React Native
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Types pour la base de données
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          bio: string | null;
          is_host: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          is_host?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          is_host?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      properties: {
        Row: {
          id: string;
          host_id: string;
          city_id: string;
          title: string;
          description: string | null;
          property_type: string;
          price_per_night: number;
          max_guests: number;
          bedrooms: number;
          bathrooms: number;
          amenities: string[] | null;
          images: string[] | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          is_active: boolean;
          rating: number;
          review_count: number;
          discount_enabled: boolean;
          discount_min_nights: number | null;
          discount_percentage: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          city_id: string;
          title: string;
          description?: string | null;
          property_type: string;
          price_per_night: number;
          max_guests?: number;
          bedrooms?: number;
          bathrooms?: number;
          amenities?: string[] | null;
          images?: string[] | null;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_active?: boolean;
          rating?: number;
          review_count?: number;
          discount_enabled?: boolean;
          discount_min_nights?: number | null;
          discount_percentage?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          city_id?: string;
          title?: string;
          description?: string | null;
          property_type?: string;
          price_per_night?: number;
          max_guests?: number;
          bedrooms?: number;
          bathrooms?: number;
          amenities?: string[] | null;
          images?: string[] | null;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_active?: boolean;
          rating?: number;
          review_count?: number;
          discount_enabled?: boolean;
          discount_min_nights?: number | null;
          discount_percentage?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      host_applications: {
        Row: {
          id: string;
          user_id: string | null;
          property_type: string;
          location: string;
          max_guests: number;
          bedrooms: number;
          bathrooms: number;
          title: string;
          description: string;
          price_per_night: number;
          full_name: string;
          email: string;
          phone: string;
          experience: string | null;
          images: string[] | null;
          amenities: string[] | null;
          minimum_nights: number | null;
          auto_booking: boolean | null;
          cancellation_policy: string | null;
          host_guide: string | null;
          cleaning_fee: number | null;
          taxes: number | null;
          discount_enabled: boolean;
          discount_min_nights: number | null;
          discount_percentage: number | null;
          status: string;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          property_type: string;
          location: string;
          max_guests: number;
          bedrooms: number;
          bathrooms: number;
          title: string;
          description: string;
          price_per_night: number;
          full_name: string;
          email: string;
          phone: string;
          experience?: string | null;
          images?: string[] | null;
          amenities?: string[] | null;
          minimum_nights?: number | null;
          auto_booking?: boolean | null;
          cancellation_policy?: string | null;
          host_guide?: string | null;
          cleaning_fee?: number | null;
          taxes?: number | null;
          discount_enabled?: boolean;
          discount_min_nights?: number | null;
          discount_percentage?: number | null;
          status?: string;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          property_type?: string;
          location?: string;
          max_guests?: number;
          bedrooms?: number;
          bathrooms?: number;
          title?: string;
          description?: string;
          price_per_night?: number;
          full_name?: string;
          email?: string;
          phone?: string;
          experience?: string | null;
          images?: string[] | null;
          amenities?: string[] | null;
          minimum_nights?: number | null;
          auto_booking?: boolean | null;
          cancellation_policy?: string | null;
          host_guide?: string | null;
          cleaning_fee?: number | null;
          taxes?: number | null;
          discount_enabled?: boolean;
          discount_min_nights?: number | null;
          discount_percentage?: number | null;
          status?: string;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          reviewed_at?: string | null;
        };
      };
      property_amenities: {
        Row: {
          id: string;
          name: string;
          icon: string | null;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon?: string | null;
          category?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string | null;
          category?: string;
          created_at?: string;
        };
      };
    };
  };
}
