import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

/**
 * Admin complet ou semi-admin.
 * - isStaff : accès hub restreint + création pour tiers + candidatures + identité
 * - isFullAdmin : tous les droits admin (seul à pouvoir promouvoir en admin)
 */
export function useOnboardingStaff() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [isFullAdmin, setIsFullAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsStaff(false);
      setIsFullAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.rpc('is_onboarding_staff' as any),
      supabase.rpc('is_admin'),
    ]).then(([staffRes, adminRes]) => {
      if (cancelled) return;
      const full = adminRes.data === true && !adminRes.error;
      const staff =
        full || (staffRes.data === true && !staffRes.error);
      setIsFullAdmin(full);
      setIsStaff(staff);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { loading, isStaff, isFullAdmin, isSemiAdmin: isStaff && !isFullAdmin };
}
