import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface VehicleApplicationData {
  vehicleType: string;
  brand: string;
  model: string;
  year: number;
  plateNumber?: string;
  seats: number;
  transmission?: string;
  fuelType?: string;
  mileage?: number;
  locationId?: string;
  location: string;
  pricePerDay: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  securityDeposit?: number;
  minimumRentalDays?: number;
  title: string;
  description: string;
  features?: string[];
  rules?: string[];
  images?: string[];
  categorizedPhotos?: Array<{url: string, category: string, displayOrder: number, isMain?: boolean}>;
  fullName: string;
  email: string;
  phone: string;
}

export interface VehicleApplication {
  id: string;
  user_id: string;
  vehicle_type: string;
  brand: string;
  model: string;
  year: number;
  plate_number?: string;
  seats: number;
  transmission?: string;
  fuel_type?: string;
  mileage?: number;
  location_id?: string;
  location: string;
  price_per_day: number;
  price_per_week?: number;
  price_per_month?: number;
  security_deposit?: number;
  minimum_rental_days?: number;
  title: string;
  description: string;
  features?: string[];
  rules?: string[];
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'revised';
  created_at: string;
  updated_at: string;
  admin_notes?: string;
  revision_message?: string;
  images?: string[];
  categorized_photos?: any;
  fields_to_revise?: Record<string, boolean>;
  full_name: string;
  email: string;
  phone: string;
}

export const useVehicleApplications = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const submitApplication = async (applicationData: VehicleApplicationData) => {
    if (!user) {
      setError('Vous devez être connecté pour soumettre une candidature');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Valider les données avant l'insertion
      console.log('📝 Données de candidature véhicule à soumettre:', {
        vehicleType: applicationData.vehicleType,
        brand: applicationData.brand,
        model: applicationData.model,
        year: applicationData.year,
        location: applicationData.location,
        pricePerDay: applicationData.pricePerDay,
        title: applicationData.title,
        fullName: applicationData.fullName,
        email: applicationData.email,
        phone: applicationData.phone,
      });

      // Vérifier que tous les champs requis sont présents
      if (!applicationData.vehicleType || !applicationData.brand || !applicationData.model || 
          !applicationData.year || !applicationData.location || !applicationData.title || 
          !applicationData.description || !applicationData.pricePerDay || !applicationData.fullName ||
          !applicationData.email || !applicationData.phone) {
        const missingFields = [];
        if (!applicationData.vehicleType) missingFields.push('Type de véhicule');
        if (!applicationData.brand) missingFields.push('Marque');
        if (!applicationData.model) missingFields.push('Modèle');
        if (!applicationData.year) missingFields.push('Année');
        if (!applicationData.location) missingFields.push('Localisation');
        if (!applicationData.title) missingFields.push('Titre');
        if (!applicationData.description) missingFields.push('Description');
        if (!applicationData.pricePerDay) missingFields.push('Prix par jour');
        if (!applicationData.fullName) missingFields.push('Nom complet');
        if (!applicationData.email) missingFields.push('Email');
        if (!applicationData.phone) missingFields.push('Téléphone');
        
        const errorMsg = `Champs manquants: ${missingFields.join(', ')}`;
        console.error('❌', errorMsg);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const { data, error } = await supabase
        .from('vehicle_applications')
        .insert({
          user_id: user.id,
          vehicle_type: applicationData.vehicleType,
          brand: applicationData.brand.trim(),
          model: applicationData.model.trim(),
          year: applicationData.year,
          plate_number: applicationData.plateNumber?.trim() || null,
          seats: applicationData.seats || 5,
          transmission: applicationData.transmission || null,
          fuel_type: applicationData.fuelType || null,
          mileage: applicationData.mileage || null,
          location_id: applicationData.locationId || null,
          location: applicationData.location.trim(),
          price_per_day: applicationData.pricePerDay,
          price_per_week: applicationData.pricePerWeek || null,
          price_per_month: applicationData.pricePerMonth || null,
          security_deposit: applicationData.securityDeposit || 0,
          minimum_rental_days: applicationData.minimumRentalDays || 1,
          title: applicationData.title.trim(),
          description: applicationData.description.trim(),
          features: applicationData.features || [],
          rules: applicationData.rules || [],
          images: applicationData.images || [],
          categorized_photos: applicationData.categorizedPhotos || null,
          full_name: applicationData.fullName.trim(),
          email: applicationData.email.trim(),
          phone: applicationData.phone.trim(),
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
        const errorMessage = error.message || 'Erreur lors de la soumission de la candidature';
        setError(errorMessage);
        return { success: false, error: errorMessage, errorDetails: error } as any;
      }

      console.log('✅ Candidature véhicule soumise avec succès:', data);
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
        .from('vehicle_applications')
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
    if (!user) return null;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('vehicle_applications')
        .select('*')
        .eq('id', applicationId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        setError('Erreur lors du chargement de la candidature');
        return null;
      }

      return data;
    } catch (err: any) {
      setError('Erreur lors du chargement de la candidature');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateApplication = async (applicationId: string, applicationData: Partial<VehicleApplicationData>) => {
    if (!user) {
      setError('Vous devez être connecté pour modifier une candidature');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Mise à jour de la candidature véhicule:', applicationId);
      
      const updateData: any = {};
      
      if (applicationData.vehicleType !== undefined) updateData.vehicle_type = applicationData.vehicleType;
      if (applicationData.brand !== undefined) updateData.brand = applicationData.brand.trim();
      if (applicationData.model !== undefined) updateData.model = applicationData.model.trim();
      if (applicationData.year !== undefined) updateData.year = applicationData.year;
      if (applicationData.plateNumber !== undefined) updateData.plate_number = applicationData.plateNumber?.trim() || null;
      if (applicationData.seats !== undefined) updateData.seats = applicationData.seats;
      if (applicationData.transmission !== undefined) updateData.transmission = applicationData.transmission || null;
      if (applicationData.fuelType !== undefined) updateData.fuel_type = applicationData.fuelType || null;
      if (applicationData.mileage !== undefined) updateData.mileage = applicationData.mileage || null;
      if (applicationData.locationId !== undefined) updateData.location_id = applicationData.locationId || null;
      if (applicationData.location !== undefined) updateData.location = applicationData.location.trim();
      if (applicationData.pricePerDay !== undefined) updateData.price_per_day = applicationData.pricePerDay;
      if (applicationData.pricePerWeek !== undefined) updateData.price_per_week = applicationData.pricePerWeek || null;
      if (applicationData.pricePerMonth !== undefined) updateData.price_per_month = applicationData.pricePerMonth || null;
      if (applicationData.securityDeposit !== undefined) updateData.security_deposit = applicationData.securityDeposit || 0;
      if (applicationData.minimumRentalDays !== undefined) updateData.minimum_rental_days = applicationData.minimumRentalDays || 1;
      if (applicationData.title !== undefined) updateData.title = applicationData.title.trim();
      if (applicationData.description !== undefined) updateData.description = applicationData.description.trim();
      if (applicationData.features !== undefined) updateData.features = applicationData.features || [];
      if (applicationData.rules !== undefined) updateData.rules = applicationData.rules || [];
      if (applicationData.images !== undefined) updateData.images = applicationData.images || [];
      if (applicationData.categorizedPhotos !== undefined) {
        updateData.categorized_photos = applicationData.categorizedPhotos || null;
      }
      if (applicationData.fullName !== undefined) updateData.full_name = applicationData.fullName.trim();
      if (applicationData.email !== undefined) updateData.email = applicationData.email.trim();
      if (applicationData.phone !== undefined) updateData.phone = applicationData.phone.trim();

      // Si la candidature est en statut 'revised', la remettre en 'pending' après modification
      const { data: currentApplication } = await supabase
        .from('vehicle_applications')
        .select('status')
        .eq('id', applicationId)
        .single();

      if (currentApplication?.status === 'revised') {
        updateData.status = 'pending';
        updateData.fields_to_revise = null;
        updateData.revision_message = null;
      }

      const { data, error } = await supabase
        .from('vehicle_applications')
        .update(updateData)
        .eq('id', applicationId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur lors de la mise à jour:', error);
        setError('Erreur lors de la mise à jour de la candidature');
        return { success: false, error: error.message };
      }

      console.log('✅ Candidature mise à jour avec succès:', data);
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Erreur lors de la mise à jour:', err);
      setError('Erreur lors de la mise à jour de la candidature');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    submitApplication,
    getMyApplications,
    getApplicationById,
    updateApplication,
    loading,
    error,
  };
};

