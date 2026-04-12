import { useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';

export interface HostApplicationData {
  propertyType: string;
  location: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  title: string;
  description: string;
  pricePerNight: number;
  /** Location mensuelle (longue durée) : loyer au mois au lieu du prix à la nuitée */
  isMonthlyRental?: boolean;
  monthlyRentPrice?: number;
  securityDeposit?: number;
  minimumDurationMonths?: number;
  chargesIncluded?: boolean;
  surfaceM2?: number;
  numberOfRooms?: number;
  isFurnished?: boolean;
  fullName: string;
  email: string;
  phone: string;
  images?: string[];
  categorizedPhotos?: Array<{url: string, category: string, displayOrder: number}>;
  amenities?: string[];
  cleaningFee?: number;
  freeCleaningMinDays?: number;
  taxes?: number;
  minimumNights?: number;
  autoBooking?: boolean;
  cancellationPolicy?: string;
  hostGuide?: string;
  discountEnabled?: boolean;
  discountMinNights?: number;
  discountPercentage?: number;
  longStayDiscountEnabled?: boolean;
  longStayDiscountMinNights?: number;
  longStayDiscountPercentage?: number;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  houseRules?: string | null;
  customAmenities?: string[];
  /** Code parrain pour cette candidature (nouvelle propriété) */
  referralCodeSubmitted?: string | null;
}

export interface HostApplication {
  id: string;
  user_id: string;
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
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  admin_notes?: string;
  revision_message?: string;
  images?: string[];
  categorized_photos?: any;
  amenities?: string[];
  minimum_nights?: number;
  auto_booking?: boolean;
  cancellation_policy?: string;
  host_guide?: string;
  discount_enabled?: boolean;
  discount_min_nights?: number;
  discount_percentage?: number;
  long_stay_discount_enabled?: boolean;
  long_stay_discount_min_nights?: number;
  long_stay_discount_percentage?: number;
  cleaning_fee?: number;
  free_cleaning_min_days?: number;
  taxes?: number;
  fields_to_revise?: Record<string, boolean>;
  is_monthly_rental?: boolean;
  monthly_rent_price?: number | null;
  security_deposit?: number | null;
  minimum_duration_months?: number | null;
  charges_included?: boolean;
  surface_m2?: number | null;
  number_of_rooms?: number | null;
  is_furnished?: boolean;
}

export const useHostApplications = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { sendHostApplicationSubmitted, sendHostApplicationReceived } = useEmailService();
  /** Évite deux insert/update concurrents (double tap ou appels rapprochés). */
  const hostApplicationMutationLockRef = useRef(false);

  const submitApplication = async (applicationData: HostApplicationData) => {
    if (!user) {
      setError('Vous devez être connecté pour soumettre une candidature');
      return { success: false };
    }
    if (hostApplicationMutationLockRef.current) {
      return { success: false, error: 'Une soumission est déjà en cours.' };
    }
    hostApplicationMutationLockRef.current = true;

    setLoading(true);
    setError(null);

    try {
      // Valider les données avant l'insertion
      console.log('📝 Données de candidature à soumettre:', {
        propertyType: applicationData.propertyType,
        location: applicationData.location,
        maxGuests: applicationData.maxGuests,
        bedrooms: applicationData.bedrooms,
        bathrooms: applicationData.bathrooms,
        title: applicationData.title,
        description: applicationData.description,
        pricePerNight: applicationData.pricePerNight,
        fullName: applicationData.fullName,
        email: applicationData.email,
        phone: applicationData.phone,
      });

      const isMonthly = !!applicationData.isMonthlyRental;
      const hasPrice = isMonthly
        ? (applicationData.monthlyRentPrice != null && applicationData.monthlyRentPrice >= 10000)
        : (applicationData.pricePerNight != null && applicationData.pricePerNight >= 1000);
      if (!applicationData.propertyType || !applicationData.location || !applicationData.title ||
          !applicationData.description || !hasPrice || !applicationData.fullName ||
          !applicationData.email || !applicationData.phone) {
        const missingFields = [];
        if (!applicationData.propertyType) missingFields.push('Type de propriété');
        if (!applicationData.location) missingFields.push('Localisation');
        if (!applicationData.title) missingFields.push('Titre');
        if (!applicationData.description) missingFields.push('Description');
        if (!hasPrice) missingFields.push(isMonthly ? 'Loyer mensuel (min. 10 000 FCFA)' : 'Prix par nuit (min. 1 000 FCFA)');
        if (!applicationData.fullName) missingFields.push('Nom complet');
        if (!applicationData.email) missingFields.push('Email');
        if (!applicationData.phone) missingFields.push('Téléphone');
        
        const errorMsg = `Champs manquants: ${missingFields.join(', ')}`;
        console.error('❌', errorMsg);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Permettre plusieurs candidatures même si une autre est en attente
      const { data, error } = await supabase
        .from('host_applications')
        .insert({
          user_id: user.id,
          property_type: applicationData.propertyType,
          location: applicationData.location.trim(), // Nettoyer les espaces
          max_guests: applicationData.maxGuests,
          bedrooms: applicationData.bedrooms,
          bathrooms: applicationData.bathrooms,
          title: applicationData.title.trim(),
          description: applicationData.description.trim(),
          price_per_night: applicationData.pricePerNight ?? 0,
          is_monthly_rental: applicationData.isMonthlyRental ?? false,
          monthly_rent_price: applicationData.monthlyRentPrice ?? null,
          security_deposit: applicationData.securityDeposit ?? null,
          minimum_duration_months: applicationData.minimumDurationMonths ?? null,
          charges_included: applicationData.chargesIncluded ?? false,
          surface_m2: applicationData.surfaceM2 ?? null,
          number_of_rooms: applicationData.numberOfRooms ?? null,
          is_furnished: applicationData.isFurnished ?? false,
          full_name: applicationData.fullName.trim(),
          email: applicationData.email.trim(),
          phone: applicationData.phone.trim(),
          images: applicationData.images || [],
          categorized_photos: applicationData.categorizedPhotos || null,
          amenities: applicationData.amenities || [],
          minimum_nights: applicationData.minimumNights || 1,
          auto_booking: applicationData.autoBooking || false,
          cancellation_policy: applicationData.cancellationPolicy || 'flexible',
          host_guide: applicationData.hostGuide?.trim() || null,
          discount_enabled: applicationData.discountEnabled || false,
          discount_min_nights: applicationData.discountMinNights || null,
          discount_percentage: applicationData.discountPercentage || null,
          long_stay_discount_enabled: applicationData.longStayDiscountEnabled || false,
          long_stay_discount_min_nights: applicationData.longStayDiscountMinNights || null,
          long_stay_discount_percentage: applicationData.longStayDiscountPercentage || null,
          cleaning_fee: applicationData.cleaningFee || 0,
          free_cleaning_min_days: applicationData.freeCleaningMinDays || null,
          taxes: applicationData.taxes || 0,
          check_in_time: applicationData.checkInTime || null,
          check_out_time: applicationData.checkOutTime || null,
          house_rules: applicationData.houseRules || null,
          custom_amenities: applicationData.customAmenities || null,
          ...(applicationData.referralCodeSubmitted
            ? { referral_code_submitted: applicationData.referralCodeSubmitted }
            : {}),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur Supabase détaillée:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        });
        // Afficher un message d'erreur plus détaillé
        const errorMessage = error.message || 'Erreur lors de la soumission de la candidature';
        setError(errorMessage);
        return { success: false, error: errorMessage, errorDetails: error } as any;
      }

      console.log('✅ Candidature soumise avec succès:', data);
      
      // Envoyer les emails de confirmation
      try {
        // Email de confirmation à l'utilisateur
        await sendHostApplicationSubmitted(
          applicationData.email,
          applicationData.fullName,
          applicationData.title,
          applicationData.propertyType,
          applicationData.location
        );

        // Email de notification aux administrateurs (user_roles ; RLS bloque profiles.role)
        const { data: admins } = await supabase.rpc('get_admin_notification_emails');

        if (admins && admins.length > 0) {
          // Envoyer à tous les administrateurs
          await Promise.all(
            admins.map(admin => 
              sendHostApplicationReceived(
                admin.email,
                applicationData.fullName,
                applicationData.email,
                applicationData.title,
                applicationData.propertyType,
                applicationData.location,
                applicationData.pricePerNight
              )
            )
          );
        }

        console.log('✅ [useHostApplications] Emails de candidature envoyés');
      } catch (emailError) {
        console.error('❌ [useHostApplications] Erreur envoi email:', emailError);
        // Ne pas faire échouer la soumission si l'email échoue
      }
      
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Erreur lors de la soumission:', err);
      setError('Erreur lors de la soumission de la candidature');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const getMyApplications = async () => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Erreur lors du chargement des candidatures');
        return [];
      }

      return data || [];
    } catch (err: any) {
      setError('Erreur lors du chargement des candidatures');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getAmenities = async () => {
    try {
      const { data, error } = await supabase
        .from('property_amenities')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erreur lors du chargement des équipements:', error);
        return [];
      }

      return data || [];
    } catch (err: any) {
      console.error('Erreur lors du chargement des équipements:', err);
      return [];
    }
  };

  const updateApplication = async (applicationId: string, applicationData: Partial<HostApplicationData>) => {
    if (!user) {
      setError('Vous devez être connecté pour modifier une candidature');
      return { success: false };
    }
    if (hostApplicationMutationLockRef.current) {
      return { success: false, error: 'Une soumission est déjà en cours.' };
    }
    hostApplicationMutationLockRef.current = true;

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Mise à jour de la candidature:', applicationId);
      
      // Récupérer l'ancienne version pour comparer
      const { data: oldApplication } = await supabase
        .from('host_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      // Détecter les changements
      const changes: string[] = [];
      if (oldApplication) {
        if (oldApplication.title !== applicationData.title) changes.push(`Titre: "${oldApplication.title}" → "${applicationData.title}"`);
        if (oldApplication.property_type !== applicationData.propertyType) changes.push(`Type: "${oldApplication.property_type}" → "${applicationData.propertyType}"`);
        if (oldApplication.location !== applicationData.location) changes.push(`Localisation: "${oldApplication.location}" → "${applicationData.location}"`);
        if (applicationData.pricePerNight != null && oldApplication.price_per_night !== applicationData.pricePerNight) changes.push(`Prix: ${oldApplication.price_per_night} → ${applicationData.pricePerNight} FCFA`);
        if (applicationData.isMonthlyRental != null && oldApplication.is_monthly_rental !== applicationData.isMonthlyRental) changes.push(`Type: ${oldApplication.is_monthly_rental ? 'Mensuel' : 'Court séjour'} → ${applicationData.isMonthlyRental ? 'Mensuel' : 'Court séjour'}`);
        if (applicationData.monthlyRentPrice != null && oldApplication.monthly_rent_price !== applicationData.monthlyRentPrice) changes.push(`Loyer mensuel: ${oldApplication.monthly_rent_price ?? '-'} → ${applicationData.monthlyRentPrice} FCFA`);
        if (oldApplication.max_guests !== applicationData.maxGuests) changes.push(`Capacité: ${oldApplication.max_guests} → ${applicationData.maxGuests}`);
        if (oldApplication.bedrooms !== applicationData.bedrooms) changes.push(`Chambres: ${oldApplication.bedrooms} → ${applicationData.bedrooms}`);
        if (oldApplication.bathrooms !== applicationData.bathrooms) changes.push(`Salles de bain: ${oldApplication.bathrooms} → ${applicationData.bathrooms}`);
      }

      const changesText = changes.length > 0 
        ? `Modifications:\n${changes.join('\n')}` 
        : 'Candidature modifiée';
      
      const { data, error } = await supabase
        .from('host_applications')
        .update({
          property_type: applicationData.propertyType,
          location: applicationData.location,
          max_guests: applicationData.maxGuests,
          bedrooms: applicationData.bedrooms,
          bathrooms: applicationData.bathrooms,
          title: applicationData.title,
          description: applicationData.description,
          price_per_night: applicationData.pricePerNight ?? 0,
          ...(applicationData.isMonthlyRental != null && {
            is_monthly_rental: applicationData.isMonthlyRental,
            monthly_rent_price: applicationData.monthlyRentPrice ?? null,
            security_deposit: applicationData.securityDeposit ?? null,
            minimum_duration_months: applicationData.minimumDurationMonths ?? null,
            charges_included: applicationData.chargesIncluded ?? false,
            surface_m2: applicationData.surfaceM2 ?? null,
            number_of_rooms: applicationData.numberOfRooms ?? null,
            is_furnished: applicationData.isFurnished ?? false,
          }),
          full_name: applicationData.fullName,
          email: applicationData.email,
          phone: applicationData.phone,
          images: applicationData.images || [],
          categorized_photos: applicationData.categorizedPhotos || null,
          amenities: applicationData.amenities || [],
          minimum_nights: applicationData.minimumNights || 1,
          auto_booking: applicationData.autoBooking || false,
          cancellation_policy: applicationData.cancellationPolicy || 'flexible',
          host_guide: applicationData.hostGuide || null,
          discount_enabled: applicationData.discountEnabled || false,
          discount_min_nights: applicationData.discountMinNights || null,
          discount_percentage: applicationData.discountPercentage || null,
          long_stay_discount_enabled: applicationData.longStayDiscountEnabled || false,
          long_stay_discount_min_nights: applicationData.longStayDiscountMinNights || null,
          long_stay_discount_percentage: applicationData.longStayDiscountPercentage || null,
          cleaning_fee: applicationData.cleaningFee || 0,
          taxes: applicationData.taxes || 0,
          status: 'reviewing',
          revision_message: changesText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        setError('Erreur lors de la mise à jour de la candidature');
        return { success: false };
      }

      console.log('✅ Candidature mise à jour avec succès:', data);
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Erreur lors de la mise à jour:', err);
      setError('Erreur lors de la mise à jour de la candidature');
      return { success: false };
    } finally {
      setLoading(false);
      hostApplicationMutationLockRef.current = false;
    }
  };

  const getApplications = async () => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Erreur lors du chargement des candidatures');
        return [];
      }

      return data || [];
    } catch (err: any) {
      setError('Erreur lors du chargement des candidatures');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getApplicationById = async (applicationId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Chargement de la candidature:', applicationId);
      
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (error) {
        console.error('❌ Error fetching application:', error);
        setError('Erreur lors du chargement de la candidature');
        return null;
      }

      console.log('✅ Candidature chargée:', data);
      return data;
    } catch (err: any) {
      console.error('❌ Error in getApplicationById:', err);
      setError('Erreur lors du chargement de la candidature');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteApplication = async (applicationId: string) => {
    if (!user) {
      setError('Vous devez être connecté pour supprimer une candidature');
      return { success: false, error: 'Non connecté' };
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🗑️ Suppression de la candidature:', applicationId);
      
      // Vérifier que la candidature appartient à l'utilisateur
      const { data: application, error: fetchError } = await supabase
        .from('host_applications')
        .select('id, user_id, status')
        .eq('id', applicationId)
        .single();

      if (fetchError) {
        console.error('❌ Erreur lors de la vérification:', fetchError);
        setError('Candidature introuvable');
        return { success: false, error: 'Candidature introuvable' };
      }

      if (application.user_id !== user.id) {
        console.error('❌ Accès non autorisé');
        setError('Vous n\'êtes pas autorisé à supprimer cette candidature');
        return { success: false, error: 'Accès non autorisé' };
      }

      // Vérifier que la candidature peut être supprimée (seulement si pending ou rejected)
      if (application.status === 'approved') {
        setError('Vous ne pouvez pas supprimer une candidature approuvée');
        return { success: false, error: 'Impossible de supprimer une candidature approuvée' };
      }

      // Supprimer la candidature
      const { error: deleteError } = await supabase
        .from('host_applications')
        .delete()
        .eq('id', applicationId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('❌ Erreur lors de la suppression:', deleteError);
        setError('Erreur lors de la suppression de la candidature');
        return { success: false, error: deleteError.message || 'Erreur lors de la suppression' };
      }

      console.log('✅ Candidature supprimée avec succès');
      return { success: true };
    } catch (err: any) {
      console.error('❌ Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression de la candidature');
      return { success: false, error: err.message || 'Erreur lors de la suppression' };
    } finally {
      setLoading(false);
    }
  };

  return {
    submitApplication,
    getMyApplications,
    getApplications,
    getAmenities,
    updateApplication,
    getApplicationById,
    deleteApplication,
    loading,
    error,
  };
};