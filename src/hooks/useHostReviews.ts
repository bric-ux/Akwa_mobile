import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface HostPropertyReview {
  id: string;
  booking_id: string;
  property_id: string;
  reviewer_id: string;
  rating: number;
  cleanliness_rating: number | null;
  communication_rating: number | null;
  location_rating: number | null;
  value_rating: number | null;
  comment: string | null;
  approved: boolean | null;
  created_at: string;
  response_deadline: string | null;
  reviewer?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  property?: {
    id: string;
    title: string;
  };
  response?: {
    id: string;
    response: string;
    created_at: string;
  };
  has_response?: boolean;
  is_deadline_passed?: boolean;
}

export interface HostReview {
  id: string;
  property_id?: string;
  vehicle_id?: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name?: string;
  property_title?: string;
  vehicle_title?: string;
  review_type: 'property' | 'vehicle';
}

export const useHostReviews = () => {
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<HostReview[]>([]);
  const { user } = useAuth();

  // Get reviews for a specific host by hostId (for public profile view)
  const getHostReviews = useCallback(async (hostId: string): Promise<void> => {
    setLoading(true);
    try {
      const allReviews: HostReview[] = [];

      // 1. Get reviews for properties
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .eq('host_id', hostId);

      if (!propError && properties?.length) {
        const propertyIds = properties.map(p => p.id);

        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(`
            id,
            property_id,
            reviewer_id,
            rating,
            comment,
            created_at,
            profiles!reviewer_id(first_name, last_name),
            properties!property_id(title)
          `)
          .in('property_id', propertyIds)
          .eq('approved', true)
          .order('created_at', { ascending: false });

        if (!reviewsError && reviewsData) {
          const propertyReviews: HostReview[] = reviewsData.map((review: any) => {
            const reviewer = review.profiles || review.profiles_reviewer_id || null;
            const property = review.properties || review.properties_property_id || null;
            
            const reviewerName = reviewer 
              ? `${reviewer.first_name || ''} ${reviewer.last_name || ''}`.trim() || 'Anonyme'
              : 'Anonyme';
            
            const propertyTitle = property?.title || 'Propriété';
            
            return {
              id: review.id,
              property_id: review.property_id,
              reviewer_id: review.reviewer_id,
              rating: review.rating || 0,
              comment: review.comment || null,
              created_at: review.created_at,
              reviewer_name: reviewerName,
              property_title: propertyTitle,
              review_type: 'property' as const,
            };
          });

          allReviews.push(...propertyReviews);
        }
      }

      // 2. Get reviews for vehicles
      const { data: vehicles, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('owner_id', hostId);

      if (!vehicleError && vehicles?.length) {
        const vehicleIds = vehicles.map(v => v.id);

        const { data: vehicleReviewsData, error: vehicleReviewsError } = await (supabase as any)
          .from('vehicle_reviews')
          .select(`
            id,
            vehicle_id,
            reviewer_id,
            rating,
            comment,
            created_at,
            profiles!vehicle_reviews_reviewer_id_fkey(first_name, last_name),
            vehicles!vehicle_reviews_vehicle_id_fkey(brand, model, title)
          `)
          .in('vehicle_id', vehicleIds)
          .eq('approved', true)
          .order('created_at', { ascending: false });

        if (!vehicleReviewsError && vehicleReviewsData) {
          const vehicleReviews: HostReview[] = vehicleReviewsData.map((review: any) => {
            const reviewer = review.profiles || review.profiles_vehicle_reviews_reviewer_id_fkey || null;
            const vehicle = review.vehicles || review.vehicles_vehicle_reviews_vehicle_id_fkey || null;
            
            const reviewerName = reviewer 
              ? `${reviewer.first_name || ''} ${reviewer.last_name || ''}`.trim() || 'Anonyme'
              : 'Anonyme';
            
            const vehicleTitle = vehicle?.title || 
              (vehicle?.brand && vehicle?.model 
                ? `${vehicle.brand} ${vehicle.model}` 
                : 'Véhicule');
            
            return {
              id: review.id,
              vehicle_id: review.vehicle_id,
              reviewer_id: review.reviewer_id,
              rating: review.rating || 0,
              comment: review.comment || null,
              created_at: review.created_at,
              reviewer_name: reviewerName,
              vehicle_title: vehicleTitle,
              review_type: 'vehicle' as const,
            };
          });

          allReviews.push(...vehicleReviews);
        }
      }

      // Sort all reviews by date (most recent first)
      allReviews.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setReviews(allReviews);
    } catch (error) {
      console.error('Error in getHostReviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get all reviews for properties owned by the host
  const getReviewsForHostProperties = async (): Promise<HostPropertyReview[]> => {
    if (!user) return [];

    setLoading(true);
    try {
      // First get host's properties
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .eq('host_id', user.id);

      if (propError || !properties?.length) {
        return [];
      }

      const propertyIds = properties.map(p => p.id);

      // Get reviews for these properties
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles!reviewer_id(first_name, last_name, avatar_url),
          properties!property_id(id, title)
        `)
        .in('property_id', propertyIds)
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
        return [];
      }

      // Get responses for these reviews
      const reviewIds = (reviews || []).map((r: any) => r.id);
      const { data: responses } = await supabase
        .from('review_responses')
        .select('*')
        .in('review_id', reviewIds);

      const now = new Date();

      return (reviews || []).map((review: any) => {
        const response = (responses || []).find((r: any) => r.review_id === review.id);
        const deadline = review.response_deadline ? new Date(review.response_deadline) : null;
        
        return {
          ...review,
          reviewer: review.profiles,
          property: review.properties,
          response,
          has_response: !!response,
          is_deadline_passed: deadline ? deadline < now : false
        };
      });
    } catch (error) {
      console.error('Error in getReviewsForHostProperties:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    reviews,
    loading,
    getHostReviews,
    getReviewsForHostProperties,
  };
};
