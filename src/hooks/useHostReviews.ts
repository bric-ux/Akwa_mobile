import { useState } from 'react';
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

export const useHostReviews = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

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
    loading,
    getReviewsForHostProperties,
  };
};
