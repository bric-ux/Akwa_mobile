-- Admin hard-delete for monthly rentals (was missing; UI already called delete).
-- Hotel establishments already have hotel_establishments_admin_all (FOR ALL).

DROP POLICY IF EXISTS "mrl_admin_delete" ON public.monthly_rental_listings;
CREATE POLICY "mrl_admin_delete"
ON public.monthly_rental_listings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
